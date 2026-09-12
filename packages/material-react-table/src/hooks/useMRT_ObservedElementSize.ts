import {
  type RefObject,
  useEffectEvent,
  useLayoutEffect,
  useState,
} from 'react';

//Reading ref.current during render (an earlier approach here) violates Rules of React and gets
//the whole component skipped by React Compiler. This measures once after mount via a layout
//effect, then keeps tracking via ResizeObserver so it stays correct across density/column
//changes too, not just the initial mount.
export const useMRT_ObservedElementSize = <T extends HTMLElement>(
  ref: RefObject<null | T>,
  measure: (element: T) => number,
) => {
  const [size, setSize] = useState(0);

  //`measure` is typically a fresh inline arrow function every render (e.g. `(el) =>
  //el.clientHeight`), so the setup effect below can't depend on it directly without
  //disconnecting/reconnecting the ResizeObserver on every render. useEffectEvent gives a stable
  //function that always sees the latest `measure` without needing it in the effect's own
  //dependency array (or an eslint-disable, which React Compiler refuses to optimize around
  //entirely) - it's only called from inside the effect below, both synchronously and later from
  //the ResizeObserver callback that same effect registers, matching React's own canonical
  //useEffectEvent usage (an Effect Event invoked from a callback the Effect itself set up).
  const onMeasure = useEffectEvent((element: T) => measure(element));

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize(onMeasure(element));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};
