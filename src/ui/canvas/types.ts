export type Tool = 'select' | 'wire' | 'text';

export const TOOL_LABEL: Record<Tool, string> = {
  select: '選択',
  wire: '配線',
  text: 'テキスト',
};
