import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_PERMISSIONS,
  PERM_APPLICATIONS_MANAGE,
  PERM_COMPANIES_MANAGE,
  PERM_INTERVIEW_EXPERIENCES_MANAGE,
  PERM_JOBS_MANAGE,
  PERM_SETTINGS_MANAGE,
  PERM_USERS_MANAGE,
  PERM_USERS_READ,
  ROUTE_PERMISSIONS,
  canAccessAdminRoute,
  computeEffectivePermissions,
  hasPermission,
  isElevatedRole,
} from "./permissions";

test("SUPER_ADMIN role inherits all permissions", () => {
  const perms = computeEffectivePermissions("SUPER_ADMIN");
  assert.equal(perms.length, ALL_PERMISSIONS.length);
  assert.ok(perms.includes(PERM_USERS_MANAGE));
  assert.ok(perms.includes(PERM_SETTINGS_MANAGE));
});

test("COORDINATOR role inherits jobs and applications manage but not user management", () => {
  const perms = computeEffectivePermissions("COORDINATOR");
  assert.ok(perms.includes(PERM_JOBS_MANAGE));
  assert.ok(perms.includes(PERM_APPLICATIONS_MANAGE));
  assert.ok(!perms.includes(PERM_USERS_MANAGE));
  assert.ok(!perms.includes(PERM_SETTINGS_MANAGE));
});

test("STUDENT role inherits empty administrative permissions by default", () => {
  const perms = computeEffectivePermissions("STUDENT");
  assert.equal(perms.length, 0);
});

test("Custom permissions allow fine-grained grants to students", () => {
  const perms = computeEffectivePermissions("STUDENT", [PERM_COMPANIES_MANAGE, PERM_JOBS_MANAGE]);
  assert.equal(perms.length, 2);
  assert.ok(perms.includes(PERM_COMPANIES_MANAGE));
  assert.ok(perms.includes(PERM_JOBS_MANAGE));
});

test("Custom permissions allow explicit revocation with minus prefix", () => {
  const perms = computeEffectivePermissions("COORDINATOR", [`-${PERM_JOBS_MANAGE}`]);
  assert.ok(!perms.includes(PERM_JOBS_MANAGE));
  assert.ok(perms.includes(PERM_APPLICATIONS_MANAGE));
});

test("hasPermission validates user permissions accurately", () => {
  assert.equal(
    hasPermission({ role: "SUPER_ADMIN", email: "student@iiitl.ac.in" }, PERM_USERS_MANAGE),
    true,
  );

  assert.equal(
    hasPermission({ role: "STUDENT", email: "student@iiitl.ac.in" }, PERM_USERS_MANAGE),
    false,
  );

  assert.equal(
    hasPermission(
      { role: "STUDENT", email: "student@iiitl.ac.in", customPermissions: [PERM_USERS_READ] },
      PERM_USERS_READ,
    ),
    true,
  );
});

test("isElevatedRole identifies administrative roles correctly", () => {
  assert.equal(isElevatedRole("SUPER_ADMIN"), true);
  assert.equal(isElevatedRole("ADMIN"), true);
  assert.equal(isElevatedRole("OFFICER"), true);
  assert.equal(isElevatedRole("COORDINATOR"), true);
  assert.equal(isElevatedRole("STUDENT"), false);
  assert.equal(isElevatedRole(null), false);
});

test("canAccessAdminRoute guards routes based on permission requirements", () => {
  const coordinator = { role: "COORDINATOR", email: "coord@iiitl.ac.in" };
  assert.equal(canAccessAdminRoute(coordinator, "/admin/job-profiles"), true);
  assert.equal(canAccessAdminRoute(coordinator, "/admin/applications"), true);
  assert.equal(canAccessAdminRoute(coordinator, "/admin/users"), false);

  const student = { role: "STUDENT", email: "student@iiitl.ac.in" };
  assert.equal(canAccessAdminRoute(student, "/admin/dashboard"), false);

  const elevatedStudent = {
    role: "STUDENT",
    email: "student@iiitl.ac.in",
    customPermissions: [PERM_USERS_READ],
  };
  assert.equal(canAccessAdminRoute(elevatedStudent, "/admin/users"), true);
});

test("interview experiences are registered and need their own permission", () => {
  assert.deepEqual(ROUTE_PERMISSIONS["/admin/interview-experiences"], [
    PERM_INTERVIEW_EXPERIENCES_MANAGE,
  ]);

  const coordinator = { role: "COORDINATOR", email: "coord@iiitl.ac.in" };
  assert.equal(canAccessAdminRoute(coordinator, "/admin/interview-experiences"), false);

  const officer = { role: "OFFICER", email: "officer@iiitl.ac.in" };
  assert.equal(canAccessAdminRoute(officer, "/admin/interview-experiences"), true);
});

test("the admin sidebar only offers routes the account can open", () => {
  // The shell derives its links from these keys, so this is the nav a
  // coordinator sees: no user management, no NOC queue, no moderation.
  const coordinator = { role: "COORDINATOR", email: "coord@iiitl.ac.in" };
  const visible = Object.keys(ROUTE_PERMISSIONS).filter((path) =>
    canAccessAdminRoute(coordinator, path),
  );

  assert.ok(visible.includes("/admin/applications"));
  assert.ok(visible.includes("/admin/job-profiles"));
  assert.equal(visible.includes("/admin/users"), false);
  assert.equal(visible.includes("/admin/noc-requests"), false);
  assert.equal(visible.includes("/admin/interview-experiences"), false);
  assert.equal(visible.includes("/admin/settings"), false);

  const superAdmin = { role: "SUPER_ADMIN", email: "boss@iiitl.ac.in" };
  assert.equal(
    Object.keys(ROUTE_PERMISSIONS).filter((path) => canAccessAdminRoute(superAdmin, path)).length,
    Object.keys(ROUTE_PERMISSIONS).length,
  );
});
