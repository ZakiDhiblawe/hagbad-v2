import { useEffect } from "react";

export function usePageChrome({ title, page, bodyClassName, root = false }) {
  useEffect(() => {
    document.title = title;
    document.body.className = bodyClassName;
    document.body.dataset.page = page;
    document.body.dataset.root = root ? "true" : "false";
  }, [bodyClassName, page, root, title]);
}
