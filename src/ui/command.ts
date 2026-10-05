/**
 * The command palette lives outside the main barrel on purpose: it pulls in cmdk, which the shell
 * loads on first open (`lazy(() => import('@/ui/command'))`).
 */
export {
  CommandGroup,
  CommandItem,
  CommandPalette,
  type CommandGroupProps,
  type CommandItemProps,
  type CommandPaletteProps,
} from './CommandPalette';
