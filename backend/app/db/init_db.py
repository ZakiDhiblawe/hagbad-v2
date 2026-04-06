from sqlalchemy.orm import Session
from app.db.base import Base, engine, SessionLocal  # Add SessionLocal import
from app.models.user import User
from app.core.security import get_password_hash

def init_db():
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Create default super admin if not exists
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@hagbad.com").first()
        if not admin:
            admin = User(
                email="admin@hagbad.com",
                full_name="System Admin",
                hashed_password=get_password_hash("Admin123!"),
                is_active=True,
                is_super_admin=True
            )
            db.add(admin)
            db.commit()
            print("Default admin created: admin@hagbad.com / Admin123!")
        else:
            print("Admin user already exists")
    except Exception as e:
        print(f"Error creating admin: {e}")
        db.rollback()
    finally:
        db.close()