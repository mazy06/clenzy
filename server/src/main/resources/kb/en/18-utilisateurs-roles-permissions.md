# Users, roles and permissions in Baitly

## What are the user roles in Baitly?

Baitly distinguishes platform roles from organization roles. On the platform side: the Super Admin (full access to all of Baitly) and the Super Manager (cross-organization management and read access); these two roles are reserved for the Baitly team. On the organization side: the Host / owner (full management of their properties, reservations, rates, contracts), the Supervisor (supervision of field teams and interventions), the Technician (maintenance interventions and repairs), the Housekeeper (cleaning interventions and inventory), as well as specialized operational roles such as Laundry and Exterior Tech, and a generic Member role. Finally, guests who book through the booking engine have a separate guest account, with no access to the back office. Each role sees a menu and a dashboard tailored to it: a technician sees their interventions, a host sees their properties and revenue.

## How do I invite a member of my team?

Invitations are sent from Settings, "Organization" tab (your organization's team section). Two modes exist: "Invite by email" — you enter the person's email address and choose their role in the organization; they receive an invitation email with a link (which you can also copy and share yourself); the invitation has an expiration date displayed after sending. Alternatively, add an existing platform user directly by selecting them and assigning them a role. The invited person clicks the link, creates their account (or signs in) and automatically joins your organization with the chosen role. The list of pending invitations is visible in the same place. Inviting members is also one of the suggested steps during initial onboarding in Baitly ("Invite members").

## How do I configure role permissions?

The "Roles & Permissions" menu (restricted to administrators) lets you fine-tune what each role can do, module by module. Select a role, then enable or disable each permission with a click: for example view, create, modify or delete properties, service requests, interventions, teams; view or modify settings; manage users; access reports. Changes apply to the interface in real time (menus and buttons appear or disappear), a demonstration tab shows the effect of permissions on navigation, and two buttons let you reset to default values or save permanently. In practice: deletion (properties, interventions, teams) is reserved for administrators by default, user management as well, and reports are open to administrators and managers.

## Who sees what in Baitly?

Display is doubly filtered: by organization and by role. Each organization only sees its own data (properties, reservations, finances) — this is strict isolation; only Baitly platform roles can see multiple organizations. Within the organization, the role determines the accessible modules: the dashboard is visible to everyone but its indicators adapt (a host sees their properties and revenue, a technician sees their interventions); the dashboard's full Analytics tab is reserved for management roles (administrator, manager, supervisor); teams are visible to field roles but managed by supervisors and managers; settings and permission configuration are reserved for administrators. A host only sees their own properties and requests. Unauthorized access attempts are blocked both in the interface and on the server side.

## How do I manage existing user accounts?

The "Users" menu (or "Users & Organizations" for the platform team) lists the accounts: last name, first name, email, role. You can create a user ("New user"), view their record, modify their information and their role. For field providers (technicians, housekeepers), the record also gives access to their rates and quality score via the "Rates & score" window. User management requires the dedicated permission, held by administrators. Note that a member can have a global role on the platform and a specific role in your organization: it is the role within the organization that governs what they can do in your organization.

## Frequently asked questions

**What is the difference between a Super Admin and a Host?**
Super Admin is a platform role reserved for the Baitly team: it has access to every organization and to global administration (users, synchronizations, AI configuration). The Host is the main role within a customer organization: they manage only their own properties, reservations, rates, contracts and teams, with no visibility into other organizations.

**How do I add a housekeeper to my team?**
Settings, Organization tab: invite them by email, choosing the housekeeper role. They will receive an invitation link to create their account and join your organization.

**Can a technician see my revenue?**
No. A technician's dashboard is centered on their interventions; financial indicators and the Analytics tab are reserved for management roles.

**The invitation link has expired — what should I do?**
Resend a new invitation from Settings, Organization tab. The expiration date of the new link is displayed after sending.

**Can I customize what a role is allowed to do?**
Yes, via the Roles & Permissions menu (administrators only): each permission can be enabled or disabled per module, with saving and the option to return to default values.

**Who can delete a property?**
By default, only administrators have deletion permissions (properties, interventions, teams). This setting can be changed in Roles & Permissions.
