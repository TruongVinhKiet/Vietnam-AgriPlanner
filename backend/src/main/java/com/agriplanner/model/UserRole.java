package com.agriplanner.model;

/**
 * User roles for the application
 * - SYSTEM_ADMIN: Super administrator (backend access only)
 * - OWNER: Farm owner with full access to their farms
 * - WORKER: Farm worker with limited access
 */
public enum UserRole {
    SYSTEM_ADMIN,
    OWNER,
    WORKER
}
