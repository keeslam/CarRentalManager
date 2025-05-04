import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * ScrollToTop is a component that scrolls the window to the top
 * whenever the location (route) changes. It should be placed high
 * in the component tree, typically right inside your router.
 */
export function ScrollToTop() {
  const [location] = useLocation();

  // Scroll to top when the location changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  // This component doesn't render anything
  return null;
}