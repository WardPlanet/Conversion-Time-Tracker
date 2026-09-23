# New Features — QA Review Checklist

## 1. Multi-Day Scheduling
**Where:** Admin → Scheduling → Book Trainer form

- [ ] Admin can select a Start date and End date to schedule a trainer across multiple days at once
- [ ] All selected days are listed in a preview before submitting, with training days (blue) and travel days (gray) visually differentiated
- [ ] Submitting creates one booking per training day plus one travel day before the first date and one travel day after the last

**Test:**

- [ ] Book a trainer for Mon–Wed; confirm 5 bookings created (3 training + 2 travel)
- [ ] Verify travel day bookings appear in gray with a plane icon on the calendar
- [ ] Verify single-day booking still works as before

---

## 2. All-Day Booking Toggle
**Where:** Admin → Scheduling → Book Trainer form

- [ ] A checkbox labelled **All day** hides the time pickers and marks the booking as all-day
- [ ] All-day bookings appear in the all-day row at the top of the week grid, not in the time column

**Test:**

- [ ] Schedule an all-day booking; verify it shows in the all-day row, not in the hour grid
- [ ] Schedule a timed booking on the same day; verify both render without overlap
- [ ] Verify the hour grid does not expand to 0–24 h when an all-day booking exists

---

## 3. Partner Organizations
**Where:** Admin → Partners (new nav item)

- [ ] Admin can create a partner organization (name + contact email)
- [ ] Admin can create partner admin accounts (username, password, name, email, linked to a partner)
- [ ] Admin can assign or unassign trainers to a partner

**Test:**

- [ ] Create a new partner; verify it appears in the partner list
- [ ] Create a partner admin account linked to that partner; verify login works
- [ ] Assign a trainer to the partner; verify they appear as partner-linked in the trainer list
- [ ] Unassign the trainer (blank partner); verify they revert to unmanaged

---

## 4. Partner Admin Portal — Work Orders
**Where:** `/partner` → Work Orders tab  
**Login:** `partner.admin` / `Welcome1!` (seeded account for Apex Training Partners)

- [ ] Partner admins see all pending training requests for their trainers
- [ ] They can Approve or Deny (with optional reason) each work order
- [ ] Approved/denied items move to a History section
- [ ] When a partner admin responds to a work order, the associated travel day bookings are also updated automatically
- [ ] Admin receives a notification when a work order is approved or denied

**Test:**

- [ ] Log in as partner admin; confirm only their trainers' bookings appear (not other trainers')
- [ ] Approve a work order; verify status updates and it moves to History
- [ ] Deny a work order with a reason; verify rejection reason is stored and visible
- [ ] Log in as admin; verify the notification appears in the bell

---

## 5. Partner Admin Portal — Task Tracker Review
**Where:** `/partner` → Task Tracker tab

- [ ] Submitted task tracker weeks from partner trainers appear here for partner admin review
- [ ] Partner admin can Approve or Reject (reason required on rejection)
- [ ] Trainer receives a notification of the decision
- [ ] Partner admin is the final approver — no admin action needed after partner approval

**Test:**

- [ ] As a partner trainer, submit a task tracker week
- [ ] Log in as partner admin; confirm the submission appears in the Task Tracker tab
- [ ] Approve it; verify the trainer receives an approval notification and the item clears from the queue
- [ ] Submit another week and reject it with a reason; verify the trainer sees the rejection reason and can resubmit

---

## 6. Partner Admin Portal — Time Clock Review
**Where:** `/partner` → Time Clock tab

- [ ] Same flow as Task Tracker but for timesheet (punch-in/out) submissions
- [ ] Partner admin is the final approver

**Test:**

- [ ] As a partner trainer, submit a timesheet week
- [ ] Log in as partner admin; confirm it appears in the Time Clock tab
- [ ] Approve and reject scenarios as above

---

## 7. Partner Admin Portal — Expense Review
**Where:** `/partner` → Expenses tab

- [ ] Pending expense reimbursements from partner trainers appear here
- [ ] Partner admin can Approve or Reject (reason required on rejection)
- [ ] Trainer is notified of the decision

**Test:**

- [ ] As a partner trainer, submit an expense
- [ ] Log in as partner admin; confirm it appears in the Expenses tab
- [ ] Approve it; verify count decreases and trainer is notified
- [ ] Reject one with a reason; verify trainer sees it and can edit and resubmit

---

## 8. Trainer Experience — Partner-Managed Trainers
**Where:** Trainer portal → Dashboard

- [ ] Trainers assigned to a partner cannot self-approve or reject work orders
- [ ] Instead of Accept/Reject buttons, they see: "Awaiting approval from your partner manager."

**Test:**

- [ ] Log in as a partner-managed trainer (e.g. `jsmith` / `trainer123`)
- [ ] Navigate to the Dashboard; confirm no Accept/Reject buttons appear on pending bookings
- [ ] Log in as a non-partner trainer; confirm Accept/Reject buttons still appear normally
