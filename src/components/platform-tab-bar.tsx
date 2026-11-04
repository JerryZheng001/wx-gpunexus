// WeChat mounts src/custom-tab-bar as a native custom component. Importing that
// entry from page code extracts its stylesheet into a shared chunk and leaves
// the isolated native component without its own WXSS.
export default function PlatformTabBar() {
  return null
}
