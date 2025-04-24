"""
Script to check the Cross-Resource Reports structure and data.

This script validates that the cross-resource reports are properly configured
and connected to resource analyses in the unified analysis flow.
"""

import asyncio
import json
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# We need to add the parent directory to the path to import the app modules
sys.path.insert(0, ".")

from app.db.session import AsyncSessionLocal
from app.models.integration import (
    Integration, ResourceType, ServiceResource
)
from app.models.reports import (
    AnalysisResourceType, AnalysisType, CrossResourceReport, 
    ReportStatus, ResourceAnalysis
)
from app.models.slack import SlackChannel, SlackWorkspace
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession


async def check_report_count(db: AsyncSession) -> Dict[str, int]:
    """
    Check the number of CrossResourceReport records.
    """
    logger.info("Checking CrossResourceReport count...")
    
    # Count total reports
    stmt = select(func.count()).select_from(CrossResourceReport)
    result = await db.execute(stmt)
    total_reports = result.scalar_one_or_none() or 0
    
    # Count reports by status
    status_counts = {}
    for status_value in ReportStatus:
        stmt = select(func.count()).select_from(CrossResourceReport).where(
            CrossResourceReport.status == status_value
        )
        result = await db.execute(stmt)
        count = result.scalar_one_or_none() or 0
        status_counts[status_value.value] = count
    
    # Count reports from the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    stmt = select(func.count()).select_from(CrossResourceReport).where(
        CrossResourceReport.created_at >= thirty_days_ago
    )
    result = await db.execute(stmt)
    recent_count = result.scalar_one_or_none() or 0
    
    results = {
        "total_reports": total_reports,
        "status_counts": status_counts,
        "recent_reports": recent_count
    }
    
    logger.info(f"CrossResourceReport count: {total_reports}")
    logger.info(f"Reports by status: {json.dumps(status_counts, indent=2)}")
    logger.info(f"Reports from last 30 days: {recent_count}")
    
    return results


async def check_analysis_count(db: AsyncSession) -> Dict[str, int]:
    """
    Check the number of ResourceAnalysis records.
    """
    logger.info("Checking ResourceAnalysis count...")
    
    # Count total analyses
    stmt = select(func.count()).select_from(ResourceAnalysis)
    result = await db.execute(stmt)
    total_analyses = result.scalar_one_or_none() or 0
    
    # Count analyses by status
    status_counts = {}
    for status_value in ReportStatus:
        stmt = select(func.count()).select_from(ResourceAnalysis).where(
            ResourceAnalysis.status == status_value
        )
        result = await db.execute(stmt)
        count = result.scalar_one_or_none() or 0
        status_counts[status_value.value] = count
    
    # Count analyses by resource type
    resource_type_counts = {}
    for resource_type in AnalysisResourceType:
        stmt = select(func.count()).select_from(ResourceAnalysis).where(
            ResourceAnalysis.resource_type == resource_type
        )
        result = await db.execute(stmt)
        count = result.scalar_one_or_none() or 0
        resource_type_counts[resource_type.value] = count
    
    # Count analyses by analysis type
    analysis_type_counts = {}
    for analysis_type in AnalysisType:
        stmt = select(func.count()).select_from(ResourceAnalysis).where(
            ResourceAnalysis.analysis_type == analysis_type
        )
        result = await db.execute(stmt)
        count = result.scalar_one_or_none() or 0
        analysis_type_counts[analysis_type.value] = count
    
    results = {
        "total_analyses": total_analyses,
        "status_counts": status_counts,
        "resource_type_counts": resource_type_counts,
        "analysis_type_counts": analysis_type_counts
    }
    
    logger.info(f"ResourceAnalysis count: {total_analyses}")
    logger.info(f"Analyses by status: {json.dumps(status_counts, indent=2)}")
    logger.info(f"Analyses by resource type: {json.dumps(resource_type_counts, indent=2)}")
    logger.info(f"Analyses by analysis type: {json.dumps(analysis_type_counts, indent=2)}")
    
    return results


async def check_report_analysis_relationships(db: AsyncSession) -> Dict[str, int]:
    """
    Check the relationships between CrossResourceReport and ResourceAnalysis records.
    """
    logger.info("Checking report-analysis relationships...")
    
    # Count analyses per report
    stmt = select(
        CrossResourceReport.id,
        func.count(ResourceAnalysis.id).label("analysis_count")
    ).outerjoin(
        ResourceAnalysis,
        CrossResourceReport.id == ResourceAnalysis.cross_resource_report_id
    ).group_by(
        CrossResourceReport.id
    )
    result = await db.execute(stmt)
    report_analysis_counts = result.fetchall()
    
    # Calculate statistics
    total_reports = len(report_analysis_counts)
    reports_with_analyses = sum(1 for r in report_analysis_counts if r[1] > 0)
    reports_without_analyses = sum(1 for r in report_analysis_counts if r[1] == 0)
    
    max_analyses = 0
    min_analyses = float('inf')
    total_analyses = 0
    
    for _, count in report_analysis_counts:
        max_analyses = max(max_analyses, count)
        if count > 0:  # Only consider reports with at least one analysis for min
            min_analyses = min(min_analyses, count)
        total_analyses += count
    
    avg_analyses = total_analyses / total_reports if total_reports > 0 else 0
    min_analyses = min_analyses if min_analyses != float('inf') else 0
    
    # Count single-channel vs multi-channel reports
    single_channel_reports = sum(1 for r in report_analysis_counts if r[1] == 1)
    multi_channel_reports = sum(1 for r in report_analysis_counts if r[1] > 1)
    
    # Count orphaned analyses (analyses without valid reports)
    stmt = select(func.count()).select_from(ResourceAnalysis).where(
        ~ResourceAnalysis.cross_resource_report_id.in_(
            select(CrossResourceReport.id).select_from(CrossResourceReport)
        )
    )
    result = await db.execute(stmt)
    orphaned_analyses = result.scalar_one_or_none() or 0
    
    results = {
        "total_reports": total_reports,
        "reports_with_analyses": reports_with_analyses,
        "reports_without_analyses": reports_without_analyses,
        "single_channel_reports": single_channel_reports,
        "multi_channel_reports": multi_channel_reports,
        "max_analyses_per_report": max_analyses,
        "min_analyses_per_report": min_analyses,
        "avg_analyses_per_report": f"{avg_analyses:.2f}",
        "orphaned_analyses": orphaned_analyses
    }
    
    logger.info(f"Report-analysis relationship statistics: {json.dumps(results, indent=2)}")
    
    # Sample reports with a lot of analyses
    if max_analyses > 5:
        stmt = select(
            CrossResourceReport
        ).outerjoin(
            ResourceAnalysis,
            CrossResourceReport.id == ResourceAnalysis.cross_resource_report_id
        ).group_by(
            CrossResourceReport.id
        ).having(
            func.count(ResourceAnalysis.id) > 5
        ).limit(3)
        result = await db.execute(stmt)
        sample_reports = result.scalars().all()
        
        logger.info("Sample reports with many analyses:")
        for report in sample_reports:
            stmt = select(func.count()).where(
                ResourceAnalysis.cross_resource_report_id == report.id
            )
            result = await db.execute(stmt)
            analysis_count = result.scalar_one_or_none() or 0
            
            logger.info(f"  Report ID: {report.id}, Title: {report.title}, Analysis count: {analysis_count}")
    
    # Log reports without analyses
    if reports_without_analyses > 0:
        stmt = select(CrossResourceReport).outerjoin(
            ResourceAnalysis,
            CrossResourceReport.id == ResourceAnalysis.cross_resource_report_id
        ).group_by(
            CrossResourceReport.id
        ).having(
            func.count(ResourceAnalysis.id) == 0
        ).limit(5)
        result = await db.execute(stmt)
        empty_reports = result.scalars().all()
        
        logger.info("Sample reports without analyses:")
        for report in empty_reports:
            logger.info(f"  Report ID: {report.id}, Title: {report.title}")
    
    return results


async def check_recently_created_reports(db: AsyncSession, days: int = 7) -> Dict[str, List[Dict]]:
    """
    Check recently created CrossResourceReport records.
    """
    logger.info(f"Checking reports created in the last {days} days...")
    
    # Get recent reports
    recent_date = datetime.utcnow() - timedelta(days=days)
    stmt = select(CrossResourceReport).where(
        CrossResourceReport.created_at >= recent_date
    ).order_by(
        desc(CrossResourceReport.created_at)
    ).limit(10)
    result = await db.execute(stmt)
    recent_reports = result.scalars().all()
    
    # Process each report
    report_details = []
    for report in recent_reports:
        # Get analyses for this report
        stmt = select(ResourceAnalysis).where(
            ResourceAnalysis.cross_resource_report_id == report.id
        )
        result = await db.execute(stmt)
        analyses = result.scalars().all()
        
        # Get team name if available
        team_name = "Unknown"
        if report.team_id:
            team_name = f"Team ID: {report.team_id}"
        
        report_detail = {
            "id": str(report.id),
            "title": report.title,
            "team": team_name,
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "status": report.status.value if report.status else None,
            "analysis_count": len(analyses),
            "parameters": report.report_parameters,
            "is_single_channel": report.report_parameters.get("single_channel_analysis", False) if report.report_parameters else False,
        }
        report_details.append(report_detail)
    
    results = {
        "count": len(recent_reports),
        "reports": report_details
    }
    
    logger.info(f"Found {len(recent_reports)} reports created in the last {days} days")
    if recent_reports:
        logger.info("Recent reports:")
        for detail in report_details:
            logger.info(f"  Report: {detail['title']}")
            logger.info(f"    ID: {detail['id']}")
            logger.info(f"    Team: {detail['team']}")
            logger.info(f"    Created: {detail['created_at']}")
            logger.info(f"    Status: {detail['status']}")
            logger.info(f"    Analysis count: {detail['analysis_count']}")
            logger.info(f"    Is single channel: {detail['is_single_channel']}")
    
    return results


async def check_report_team_ids(db: AsyncSession) -> Dict[str, int]:
    """
    Check CrossResourceReport team_id assignments.
    """
    logger.info("Checking CrossResourceReport team_id assignments...")
    
    # Count total reports
    stmt = select(func.count()).select_from(CrossResourceReport)
    result = await db.execute(stmt)
    total_reports = result.scalar_one_or_none() or 0
    
    # Count reports with null team_id
    stmt = select(func.count()).select_from(CrossResourceReport).where(
        CrossResourceReport.team_id.is_(None)
    )
    result = await db.execute(stmt)
    null_team_id_count = result.scalar_one_or_none() or 0
    
    # Calculate percentage
    percentage = 0
    if total_reports > 0:
        percentage = (null_team_id_count / total_reports) * 100
    
    results = {
        "total_reports": total_reports,
        "null_team_id_count": null_team_id_count,
        "percentage": f"{percentage:.1f}%"
    }
    
    logger.info(f"CrossResourceReport team_id check: {results}")
    
    if null_team_id_count > 0:
        logger.warning(f"{null_team_id_count} reports ({percentage:.1f}%) have null team_id values")
        
        # Get list of reports with null team_id
        stmt = select(CrossResourceReport).where(
            CrossResourceReport.team_id.is_(None)
        ).limit(5)
        result = await db.execute(stmt)
        null_reports = result.scalars().all()
        
        logger.info("Sample reports with null team_id:")
        for report in null_reports:
            logger.info(f"  Report ID: {report.id}, Title: {report.title}")
            
            # Check analyses for this report
            stmt = select(ResourceAnalysis).where(
                ResourceAnalysis.cross_resource_report_id == report.id
            )
            result = await db.execute(stmt)
            analyses = result.scalars().all()
            
            if analyses:
                # Check if any analysis has a linked integration with owner_team_id
                for analysis in analyses:
                    if analysis.integration_id:
                        stmt = select(Integration).where(
                            Integration.id == analysis.integration_id
                        )
                        result = await db.execute(stmt)
                        integration = result.scalar_one_or_none()
                        
                        if integration and integration.owner_team_id:
                            logger.info(f"    Could use integration.owner_team_id: {integration.owner_team_id}")
                            break
    
    return results


async def main():
    """
    Main function to run all checks.
    """
    logger.info("Starting Cross-Resource Reports validation")
    
    db = AsyncSessionLocal()
    
    try:
        # Run all checks
        report_counts = await check_report_count(db)
        analysis_counts = await check_analysis_count(db)
        relationship_stats = await check_report_analysis_relationships(db)
        recent_reports = await check_recently_created_reports(db)
        team_id_check = await check_report_team_ids(db)
        
        # Overall result summary
        logger.info("=== Validation Summary ===")
        
        issues_found = 0
        
        if relationship_stats["reports_without_analyses"] > 0:
            issues_found += 1
            logger.warning(f"⚠️ {relationship_stats['reports_without_analyses']} reports have no associated analyses")
        
        if relationship_stats["orphaned_analyses"] > 0:
            issues_found += 1
            logger.warning(f"⚠️ {relationship_stats['orphaned_analyses']} analyses are orphaned (no valid report)")
        
        if team_id_check["null_team_id_count"] > 0:
            issues_found += 1
            logger.warning(f"⚠️ {team_id_check['null_team_id_count']} reports have missing team_id values")
        
        if issues_found == 0:
            logger.info("✅ No issues found! The cross-resource reports structure looks good.")
        else:
            logger.warning(f"⚠️ Found {issues_found} potential issues that might affect the reports functionality.")
            logger.info("It's recommended to fix these issues for optimal system performance.")
        
        # Print validation totals
        logger.info("=== Validation Totals ===")
        logger.info(f"Total CrossResourceReport records: {report_counts['total_reports']}")
        logger.info(f"Total ResourceAnalysis records: {analysis_counts['total_analyses']}")
        logger.info(f"Single-channel reports: {relationship_stats['single_channel_reports']}")
        logger.info(f"Multi-channel reports: {relationship_stats['multi_channel_reports']}")
        logger.info(f"Average analyses per report: {relationship_stats['avg_analyses_per_report']}")
        logger.info(f"Reports created in last 7 days: {recent_reports['count']}")
        
    except Exception as e:
        logger.error(f"Error running checks: {str(e)}", exc_info=True)
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())