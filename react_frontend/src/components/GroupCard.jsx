import { badgeTone, capitalize, formatDate, groupCoverStyle, groupImageUrl, initials } from "../lib/format";

function Badge({ children, tone }) {
  return <span className={`group-card-badge ${badgeTone(tone)}`}>{children}</span>;
}

export default function GroupCard({ group, metaText, actions = [] }) {
  const coverStyle = groupCoverStyle(group);
  const imageUrl = groupImageUrl(group);
  const createdLabel = formatDate(group.created_at);

  return (
    <article className="group-card">
      <div className={`group-card-cover ${coverStyle ? "has-image" : "no-image"}`} style={coverStyle}>
        {!coverStyle ? <span className="group-card-cover-fallback">{initials(group.name)}</span> : null}
      </div>

      <img className="group-card-avatar" src={imageUrl} alt={`${group.name} group`} />

      <div className="group-card-body">
        <div className="group-card-top">
          <h3 className="group-card-title">{group.name}</h3>
          <span className="group-card-date">{createdLabel}</span>
        </div>

        <p className="group-card-description">{group.description || "No group description has been added yet."}</p>

        <div className="group-card-badges">
          <Badge tone={group.privacy}>{capitalize(group.privacy)}</Badge>
          <Badge tone={group.visible ? "visible" : "hidden"}>{group.visible ? "Visible" : "Hidden"}</Badge>
          <Badge tone={group.status}>{capitalize(group.status)}</Badge>
        </div>

        <div className="group-card-meta">{metaText}</div>

        {actions.length ? <div className="group-card-actions">{actions}</div> : null}
      </div>
    </article>
  );
}
