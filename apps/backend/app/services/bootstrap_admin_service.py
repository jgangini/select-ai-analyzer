import logging

from apps.backend.app.core.security import get_password_hash
from apps.backend.app.core.tracing import trace

logger = logging.getLogger(__name__)


class BootstrapAdminMixin:
    @trace
    def create_admin_user(
        self,
        email: str,
        admin_password: str,
        *,
        wallet_path: str | None = None,
        wallet_password: str | None = None,
        user: str | None = None,
        db_password: str | None = None,
        dsn: str | None = None,
    ) -> bool:
        conn = self._get_direct_connection(
            wallet_path=wallet_path,
            wallet_password=wallet_password,
            user=user,
            password=db_password,
            dsn=dsn,
        )
        cursor = conn.cursor()
        try:
            hashed_password = get_password_hash(admin_password)
            cursor.execute("SELECT COUNT(*) FROM users WHERE user_id = 0")
            count = cursor.fetchone()[0]
            if count > 0:
                cursor.execute(
                    """
                    UPDATE users
                    SET user_username = :username,
                        user_password = :password
                    WHERE user_id = 0
                    """,
                    username=email,
                    password=hashed_password,
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO users (
                        user_id, user_group_id, user_username, user_password,
                        user_name, user_last_name
                    ) VALUES (
                        0, 0, :username, :password,
                        'Administrator', 'System'
                    )
                    """,
                    username=email,
                    password=hashed_password,
                )
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            logger.exception("Error creating admin user: %s", e)
            raise RuntimeError(f"Error creating admin user: {e}") from e
        finally:
            cursor.close()
            conn.close()

    def update_admin_password(self, new_password: str) -> bool:
        conn = self._get_direct_connection()
        cursor = conn.cursor()
        try:
            hashed_password = get_password_hash(new_password)
            cursor.execute(
                """
                UPDATE users SET user_password = :hashed_password
                WHERE user_id = 0
                """,
                hashed_password=hashed_password,
            )
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            logger.error("Error updating admin password: %s", e)
            raise RuntimeError(f"Error updating admin password: {e}") from e
        finally:
            cursor.close()
            conn.close()
