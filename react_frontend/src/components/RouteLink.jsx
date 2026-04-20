function isPlainLeftClick(event) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

export default function RouteLink({ to, navigate, onClick, children, ...props }) {
  function handleClick(event) {
    if (onClick) onClick(event);
    if (event.defaultPrevented) return;
    if (!isPlainLeftClick(event)) return;
    if (props.target && props.target !== "_self") return;
    if (typeof to !== "string" || /^https?:\/\//i.test(to)) return;

    event.preventDefault();
    navigate(to);
  }

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
