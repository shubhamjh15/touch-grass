'use client';

import { AboutBlock } from '../settings/AboutBlock';
import { CoachSettings } from '../settings/CoachSettings';
import { ExperienceSettings } from '../settings/ExperienceSettings';
import { StartingLine } from '../settings/StartingLine';
import { TreeSettings } from '../settings/TreeSettings';

/** Every setting, in five groups: you and your tree, the starting line, experience, coach, about. */
export function SettingsPanel() {
  return (
    <div className="grid gap-8">
      <TreeSettings />
      <StartingLine />
      <ExperienceSettings />
      <CoachSettings />
      <AboutBlock />
    </div>
  );
}
