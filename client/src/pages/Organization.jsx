import { useEffect, useState } from "react";
import { ShieldCheck, Users, UserPlus, Check, X } from "lucide-react";
import { getOrg, updateMemberRole } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Organization() {
  const { user } = useAuth();
  const [org, setOrg] = useState(user?.org || null);
  const [members, setMembers] = useState(user?.org?.members || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [draftRoles, setDraftRoles] = useState({});
  const canManage = Boolean(user?.isAdmin);
  const configuredRoles = Array.from(new Set([
    ...(org?.officers || []).map((officer) => officer.role).filter(Boolean),
    ...members.map((member) => member.role).filter(Boolean),
  ]));

  useEffect(() => {
    getOrg()
      .then((data) => {
        setOrg(data);
        setMembers(data.members || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function updateRole(member, role, isAdmin) {
    setSavingId(member.id);
    try {
      const updated = await updateMemberRole(member.id, role, isAdmin);
      setMembers((items) => items.map((item) => item.id === member.id ? { ...item, ...updated.member } : item));
      setDraftRoles((roles) => ({ ...roles, [member.id]: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId("");
    }
  }

  if (loading) return <p className="muted">Loading organization…</p>;
  if (error) return <p className="form-error">Couldn't load organization: {error}</p>;

  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
        <div>
          <h1>{org?.name || "Organization"}</h1>
          <p className="muted" style={{ marginTop: 3, fontSize: "0.85rem" }}>
            Manage member roles, organization ownership, and task visibility.
          </p>
        </div>
        <span className={`badge badge-${canManage ? "success" : "neutral"}`}>
          {canManage ? "Admin access" : "Read-only member"}
        </span>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: 18 }}>
        <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>Organization details</h2>
        <div className="form-grid">
          <label className="form-field"><span className="form-label">Organization type</span><div className="input">{org?.type || "—"}</div></label>
          <label className="form-field"><span className="form-label">Member count</span><div className="input">{members.length}</div></label>
          <label className="form-field"><span className="form-label">Invite code</span><div className="input">{org?.join_code || "—"}</div></label>
          <label className="form-field"><span className="form-label">Created by</span><div className="input">{org?.created_by || "—"}</div></label>
        </div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--color-border-light)" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: 4 }}>Members & roles</h2>
          <p className="muted" style={{ fontSize: "0.8rem" }}>Roles determine task visibility. Admins can assign roles and organization ownership.</p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ textAlign: "left", padding: "12px 18px", fontSize: "0.75rem" }}>Member</th><th style={{ textAlign: "left", padding: "12px 18px", fontSize: "0.75rem" }}>Role</th><th style={{ textAlign: "left", padding: "12px 18px", fontSize: "0.75rem" }}>Admin</th></tr></thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td style={{ padding: "12px 18px", borderTop: "1px solid var(--color-border-light)" }}>
                  <strong style={{ display: "block", fontSize: "0.85rem" }}>{member.name}</strong>
                  <span className="muted" style={{ fontSize: "0.75rem" }}>{member.email}</span>
                </td>
                <td style={{ padding: "12px 18px", borderTop: "1px solid var(--color-border-light)" }}>
                  {canManage ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        className="select"
                        value={(draftRoles[member.id] ?? member.role) || "officer"}
                        onChange={(e) => setDraftRoles((roles) => ({ ...roles, [member.id]: e.target.value }))}
                        disabled={savingId === member.id}
                        style={{ maxWidth: 220 }}
                      >
                        <option value="officer">Officer</option>
                        {configuredRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                      <button className="btn btn-primary btn-sm" onClick={() => updateRole(member, draftRoles[member.id] ?? member.role, member.isAdmin)} disabled={savingId === member.id}>Save</button>
                    </div>
                  ) : member.role || "officer"}
                </td>
                <td style={{ padding: "12px 18px", borderTop: "1px solid var(--color-border-light)" }}>
                  {canManage ? (
                    <button
                      className={`btn btn-sm ${member.isAdmin ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => updateRole(member, member.role || "officer", !member.isAdmin)}
                      disabled={savingId === member.id}
                    >
                      {member.isAdmin ? <Check size={13} /> : <X size={13} />}
                      {member.isAdmin ? "Admin" : "Make admin"}
                    </button>
                  ) : member.isAdmin ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!canManage && <p className="muted" style={{ marginTop: 12 }}>Only an organization admin can change roles or admin access.</p>}
      {org?.created_by === user?.id && <div className="muted" style={{ marginTop: 12 }}><ShieldCheck size={14} /> You are the organization owner.</div>}
      <div className="muted" style={{ marginTop: 12 }}><UserPlus size={14} /> Role changes must match the organization’s configured officer roles.</div>
    </div>
  );
}
