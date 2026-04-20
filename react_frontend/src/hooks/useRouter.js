import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

function normalizeLocation(input) {
  const url = new URL(String(input || "/"), window.location.origin);
  let pathname = String(url.pathname || "/").trim();
  if (!pathname || pathname === "//") pathname = "/";
  if (pathname.endsWith("/") && pathname !== "/") pathname = pathname.slice(0, -1);

  return {
    pathname,
    search: url.search || "",
  };
}

export function useRouter() {
  const [location, setLocation] = useState(() =>
    normalizeLocation(`${window.location.pathname}${window.location.search}`)
  );

  const syncLocation = useEffectEvent(() => {
    startTransition(() => {
      setLocation(normalizeLocation(`${window.location.pathname}${window.location.search}`));
    });
  });

  useEffect(() => {
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, [syncLocation]);

  function navigate(nextTarget, { replace = false } = {}) {
    const target = normalizeLocation(nextTarget);
    if (target.pathname === location.pathname && target.search === location.search) return;

    const href = `${target.pathname}${target.search}`;
    if (replace) {
      window.history.replaceState(null, "", href);
    } else {
      window.history.pushState(null, "", href);
    }

    startTransition(() => {
      setLocation(target);
    });

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  return useMemo(
    () => ({
      pathname: location.pathname,
      search: location.search,
      searchParams: new URLSearchParams(location.search),
      navigate,
      isActive(path) {
        return normalizeLocation(path).pathname === location.pathname;
      },
    }),
    [location]
  );
}
