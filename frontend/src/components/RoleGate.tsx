export default function RoleGate({ roles, userRoles, children }:{ 
  roles: string[]; userRoles?: string[]; children: JSX.Element
}) {
  if (!userRoles?.some(r => roles.includes(r))) return null;
  return children;
}
