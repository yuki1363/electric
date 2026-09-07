import type { ProjectMeta } from '../../model/types';
import { useDispatch } from '../../state/context';
import { Row, Section, SelectField, TextField } from '../fields';

export function ProjectMetaForm({ meta }: { meta: ProjectMeta }) {
  const dispatch = useDispatch();
  const set = (patch: Partial<ProjectMeta>) => dispatch({ type: 'SET_META', meta: patch });
  return (
    <Section title="プロジェクト情報（表題欄）">
      <Row label="図面名（物件名）">
        <TextField value={meta.name} onCommit={(v) => set({ name: v })} width={260} />
      </Row>
      <Row label="図番">
        <TextField value={meta.drawingNo} onCommit={(v) => set({ drawingNo: v })} width={160} />
      </Row>
      <Row label="日付">
        <input type="date" value={meta.date} onChange={(e) => set({ date: e.target.value })} />
      </Row>
      <Row label="作成者">
        <TextField value={meta.author} onCommit={(v) => set({ author: v })} width={160} />
      </Row>
      <Row label="会社名">
        <TextField value={meta.company ?? ''} onCommit={(v) => set({ company: v })} width={260} />
      </Row>
      <Row label="用紙">
        <SelectField
          value={meta.sheet.size}
          options={[
            { value: 'A3', label: 'A3 横（推奨）' },
            { value: 'A4', label: 'A4 横' },
          ]}
          onChange={(v) => set({ sheet: { ...meta.sheet, size: v } })}
        />
      </Row>
    </Section>
  );
}
