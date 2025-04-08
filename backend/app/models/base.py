"""
Base model with common fields for all models.
"""
import uuid
from datetime import datetime
from typing import Any, Dict

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declared_attr


class BaseModel:
    """
    Base model with common fields.
    """
    
    @declared_attr
    def __tablename__(cls) -> str:
        """
        Generate __tablename__ automatically from class name.
        """
        return cls.__name__.lower()
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    def dict(self) -> Dict[str, Any]:
        """
        Convert model instance to dictionary.
        """
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}