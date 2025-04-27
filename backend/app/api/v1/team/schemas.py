"""
Pydantic schemas for team API endpoints.
"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class TeamBase(BaseModel):
    """Base schema for team data."""

    name: str = Field(..., description="Team name", max_length=255)
    slug: str = Field(..., description="URL-friendly team identifier", max_length=255)
    description: Optional[str] = Field(None, description="Team description")
    avatar_url: Optional[str] = Field(None, description="URL for team avatar/logo")
    is_personal: bool = Field(False, description="Whether this is a personal team")


class TeamCreate(TeamBase):
    """Schema for creating a new team."""

    team_metadata: Optional[Dict] = Field(None, description="Additional team metadata")


class TeamUpdate(BaseModel):
    """Schema for updating an existing team."""

    name: Optional[str] = Field(None, description="Team name", max_length=255)
    slug: Optional[str] = Field(None, description="URL-friendly team identifier", max_length=255)
    description: Optional[str] = Field(None, description="Team description")
    avatar_url: Optional[str] = Field(None, description="URL for team avatar/logo")
    team_metadata: Optional[Dict] = Field(None, description="Additional team metadata")


class TeamMemberBase(BaseModel):
    """Base schema for team member data."""

    user_id: str = Field(..., description="User ID")
    email: Optional[EmailStr] = Field(None, description="User email")
    display_name: Optional[str] = Field(None, description="User display name")
    role: str = Field(..., description="Member role in the team")


class TeamMemberCreate(TeamMemberBase):
    """Schema for adding a new team member."""

    invitation_status: str = Field("pending", description="Invitation status")


class TeamMemberUpdate(BaseModel):
    """Schema for updating a team member."""

    role: Optional[str] = Field(None, description="Member role in the team")
    display_name: Optional[str] = Field(None, description="User display name")
    invitation_status: Optional[str] = Field(None, description="Invitation status")


class TeamMemberInvite(BaseModel):
    """Schema for inviting a user to a team."""

    email: EmailStr = Field(..., description="User email to invite")
    role: str = Field("member", description="Role to assign to the invited user")


class TeamMemberResponse(TeamMemberBase):
    """Response schema for team member data."""

    id: UUID = Field(..., description="Team member ID")
    team_id: UUID = Field(..., description="Team ID")
    invitation_status: str = Field(..., description="Invitation status")
    created_at: datetime = Field(..., description="Time when the member was added")
    last_active_at: Optional[datetime] = Field(None, description="Time of last activity")

    class Config:
        """Pydantic configuration."""

        orm_mode = True


class TeamResponse(TeamBase):
    """Response schema for team data."""

    id: UUID = Field(..., description="Team ID")
    created_by_user_id: str = Field(..., description="Creator's user ID")
    created_by_email: Optional[str] = Field(None, description="Creator's email")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    team_size: int = Field(0, description="Number of team members")
    members: Optional[List[TeamMemberResponse]] = Field(None, description="Team members")

    class Config:
        """Pydantic configuration."""

        orm_mode = True
