import { Role } from "../../context/RolesContext";

interface RoleBadgeProps {
  role?: Role;
  size?: "sm" | "md";
}

export function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  if (!role) return null;
  const pad = size === "sm" ? "2px 8px" : "4px 10px";
  const fontSize = size === "sm" ? 11 : 12;
  return (
    <span
      className="role-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: pad,
        fontSize,
        fontWeight: 700,
        color: role.textColor,
        background: role.color,
        border: "1px solid rgba(255,255,255,0.18)",
      }}
      title={role.label}
    >
      {role.emoji ? <span aria-hidden>{role.emoji}</span> : null}
      <span>{role.label}</span>
    </span>
  );
}

