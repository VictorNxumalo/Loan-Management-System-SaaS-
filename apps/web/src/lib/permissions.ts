import { UserRole } from '@lms/types';

export function canManageRecords(role?: string): boolean {
  return role === UserRole.ADMIN || role === UserRole.LOAN_OFFICER;
}

export function canManageSettings(role?: string): boolean {
  return role === UserRole.ADMIN;
}

export function isViewer(role?: string): boolean {
  return role === UserRole.VIEWER;
}
