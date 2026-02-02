# AgriPlanner Backend

Java Spring Boot backend for the AgriPlanner agricultural management system.

## Technology Stack

- **Language**: Java 17+
- **Framework**: Spring Boot 3.x
- **Database**: PostgreSQL
- **ORM**: Spring Data JPA / Hibernate
- **Security**: Spring Security with JWT
- **Build Tool**: Maven

## Project Structure

```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/agriplanner/
│   │   │   ├── AgriplannerApplication.java
│   │   │   ├── config/
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   ├── repository/
│   │   │   ├── model/
│   │   │   ├── dto/
│   │   │   ├── exception/
│   │   │   └── util/
│   │   └── resources/
│   │       ├── application.properties
│   │       ├── application-dev.properties
│   │       └── application-prod.properties
│   └── test/
└── pom.xml
```

## Database Migrations (Flyway)

**Critical Note:** The project uses Flyway for database migrations. However, some newer migrations (including V30+ for planning zones and soil types) are located in `database/migrations` instead of the standard `backend/src/main/resources/db/migration` path.

To ensure all tables are created correctly, you must configure Flyway to look at both locations. Add this to your `application.properties`:

```properties
# P3 FIX: Flyway Configuration for dual migration paths
spring.flyway.locations=classpath:db/migration,filesystem:../../database/migrations
spring.flyway.check-location=false
```

Alternatively, copy the SQL files from `database/migrations` to `backend/src/main/resources/db/migration`.


## Getting Started

### Prerequisites

1. Java 17 or higher
2. Maven 3.8+
3. PostgreSQL 14+

### Setup

1. Create PostgreSQL database:
   ```sql
   CREATE DATABASE agriplanner;
   CREATE USER agriplanner_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE agriplanner TO agriplanner_user;
   ```

2. Update `application.properties` with your database credentials

3. Run the application:
   ```bash
   mvn spring-boot:run
   ```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| POST | /api/auth/register | User registration |
| GET | /api/users/me | Get current user |
| GET | /api/fields | Get all fields |
| POST | /api/fields | Create field |
| GET | /api/livestock | Get all livestock |
| GET | /api/analytics/summary | Get analytics summary |

## Development

Run in development mode:
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

Run tests:
```bash
mvn test
```
## Source Ownership Notice

This project contains internal ownership signatures
used for copyright verification.
Unauthorized redistribution is prohibited.
