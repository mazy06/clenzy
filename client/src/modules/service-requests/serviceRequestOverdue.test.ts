import { describe, expect, it } from "vitest";
import { isServiceRequestOverdue, overdueServiceRequestsFirst } from "./serviceRequestsUtils";

const now = Date.parse("2026-09-16T12:00:00Z");
const request = (id: string, status: string, dueDate: string) => ({ id, status, dueDate });

describe("service request overdue ordering", () => {
  it("excludes closed requests and missing, invalid or future dates", () => {
    for (const status of ["COMPLETED", "cancelled", "REJECTED"]) {
      expect(isServiceRequestOverdue(request("1", status, "2026-09-10T12:00:00Z"), now)).toBe(false);
    }
    for (const dueDate of ["", "invalid", "2026-09-17T12:00:00Z", "2026-09-16T12:00:00Z"]) {
      expect(isServiceRequestOverdue(request("1", "PENDING", dueDate), now)).toBe(false);
    }
    expect(isServiceRequestOverdue(request("1", "IN_PROGRESS", "2026-09-15T12:00:00Z"), now)).toBe(true);
  });

  it("puts oldest overdue requests first without mutating the source or reordering the rest", () => {
    const requests = [
      request("future", "PENDING", "2026-09-20T12:00:00Z"),
      request("recent", "PENDING", "2026-09-15T12:00:00Z"),
      request("closed", "COMPLETED", "2026-09-01T12:00:00Z"),
      request("oldest", "ASSIGNED", "2026-09-10T12:00:00Z"),
    ];
    expect(overdueServiceRequestsFirst(requests, now).map(r => r.id)).toEqual(["oldest", "recent", "future", "closed"]);
    expect(requests.map(r => r.id)).toEqual(["future", "recent", "closed", "oldest"]);
  });
});
