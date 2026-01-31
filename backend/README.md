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
