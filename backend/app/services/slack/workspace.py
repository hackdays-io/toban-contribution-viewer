"""
Service for managing Slack workspace data.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.slack import SlackWorkspace
from app.services.slack.api import SlackApiClient, SlackApiError

# Configure logging
logger = logging.getLogger(__name__)


class WorkspaceService:
    """
    Service for retrieving and managing Slack workspace information.
    """
    
    @staticmethod
    async def get_workspace_metadata(
        db: AsyncSession,
        workspace_id: str
    ) -> Optional[SlackWorkspace]:
        """
        Get a workspace by ID.
        
        Args:
            db: Database session
            workspace_id: UUID of the workspace
            
        Returns:
            Workspace if found, None otherwise
        """
        result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
        )
        return result.scalars().first()
    
    @staticmethod
    async def update_workspace_metadata(
        db: AsyncSession,
        workspace: SlackWorkspace
    ) -> SlackWorkspace:
        """
        Fetch and update workspace metadata from Slack API.
        
        Args:
            db: Database session
            workspace: Workspace to update
            
        Returns:
            Updated workspace
            
        Raises:
            HTTPException: If there's an error communicating with Slack API
        """
        if not workspace.access_token:
            logger.error(f"No access token for workspace {workspace.id}")
            raise ValueError("Workspace has no access token")
        
        try:
            # Create Slack API client
            client = SlackApiClient(workspace.access_token)
            
            # Get workspace info and user count
            team_info = await client.get_workspace_info()
            user_count = await client.get_user_count()
            
            # Update workspace with fetched data
            workspace.name = team_info.get("name", workspace.name)
            workspace.domain = team_info.get("domain", workspace.domain)
            
            # Get the icon URL - try different sizes if the standard one isn't available
            icon_data = team_info.get("icon", {})
            # Log the available icon data for debugging
            logger.info(f"Workspace icon data: {icon_data}")
            
            # Try different icon sizes in order of preference
            for size in ["image_132", "image_230", "image_88", "image_68", "image_44", "image_34"]:
                if size in icon_data and icon_data[size]:
                    workspace.icon_url = icon_data[size]
                    logger.info(f"Using icon size {size}: {workspace.icon_url}")
                    break
            
            workspace.team_size = user_count
            
            # Store additional metadata
            workspace.workspace_metadata = {
                "team_id": team_info.get("id"),
                "icon_default": team_info.get("icon", {}).get("is_default", True),
                "enterprise_id": team_info.get("enterprise_id"),
                "enterprise_name": team_info.get("enterprise_name"),
                "has_profile_fields": team_info.get("has_profile_fields", False),
                "last_updated": datetime.utcnow().isoformat()
            }
            
            # Save changes
            db.add(workspace)
            await db.commit()
            await db.refresh(workspace)
            
            return workspace
            
        except SlackApiError as e:
            logger.error(f"Error updating workspace metadata: {str(e)}")
            # Handle token invalidation
            if e.error_code in ["invalid_auth", "token_expired"]:
                workspace.is_connected = False
                workspace.connection_status = "token_expired"
                db.add(workspace)
                await db.commit()
                
            raise HTTPException(
                status_code=500,
                detail=f"Error fetching workspace data from Slack: {str(e)}"
            )
    
    @staticmethod
    async def verify_workspace_tokens(
        db: AsyncSession,
        workspace_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Verify tokens for one or all workspaces.
        
        Args:
            db: Database session
            workspace_id: Optional ID of specific workspace to verify
            
        Returns:
            List of verification results with status
        """
        results = []
        
        # Query workspaces
        query = select(SlackWorkspace).where(SlackWorkspace.is_connected.is_(True))
        if workspace_id:
            query = query.where(SlackWorkspace.id == workspace_id)
            
        result = await db.execute(query)
        workspaces = result.scalars().all()
        
        for workspace in workspaces:
            verification_result = {
                "workspace_id": str(workspace.id),
                "workspace_name": workspace.name,
                "status": "verified",
                "message": "Token is valid"
            }
            
            try:
                if not workspace.access_token:
                    verification_result["status"] = "error"
                    verification_result["message"] = "No access token"
                    results.append(verification_result)
                    continue
                
                # Create client and verify token
                logger.info(f"Verifying token for workspace {workspace.id} ({workspace.name})")
                client = SlackApiClient(workspace.access_token)
                is_valid = await client.verify_token()
                logger.info(f"Token verification result for workspace {workspace.id}: {is_valid}")
                
                if not is_valid:
                    # Update workspace status
                    workspace.is_connected = False
                    workspace.connection_status = "token_expired"
                    db.add(workspace)
                    
                    verification_result["status"] = "invalid"
                    verification_result["message"] = "Token is invalid or expired"
            
            except Exception as e:
                logger.error(f"Error verifying token for workspace {workspace.id}: {str(e)}")
                verification_result["status"] = "error"
                verification_result["message"] = f"Error during verification: {str(e)}"
            
            results.append(verification_result)
        
        # Commit any changes made
        await db.commit()
        
        return results