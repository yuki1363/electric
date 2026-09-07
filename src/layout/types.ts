import type { Diagram } from '../model/types';

export interface GenResult {
  diagram: Diagram;
  warnings: string[];
}
