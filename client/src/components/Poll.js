import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, Modal, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrutColors, isAr, BrutNav } from './Brut';

const DURATIONS = [15, 30, 60];

function formatRemaining(remainingMs, ar) {
  const seconds = Math.max(0, Math.round(remainingMs / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 1) return `${m}:${String(s).padStart(2, '0')}`;
  return ar ? `${s} ث` : `${s}s`;
}

// ── Poll card ─────────────────────────────────────────────────────────────────
export function PollCard({ poll, onVote, onDelete, currentUserId, ar }) {
  const { ACCENT, TEXT, MUTED, SEPARATOR, FILL, CARD, BG } = useBrutColors();

  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, new Date(poll.expiresAt).getTime() - Date.now());
  const isExpired = remainingMs <= 0;
  const isCreator = currentUserId && String(poll.creator) === String(currentUserId);
  const total = poll.totalVotes ?? poll.options.reduce((s, o) => s + (o.count || 0), 0);
  const startSide = ar ? 'right' : 'left';

  return (
    <View style={[card.card, { backgroundColor: CARD, borderColor: SEPARATOR }]}>
      {/* Header */}
      <View style={[card.headerRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <View style={[card.typePill, { backgroundColor: FILL }]}>
          <Text style={[card.typeText, { color: MUTED }]}>{ar ? 'تصويت' : 'Poll'}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[card.timer, { color: isExpired ? MUTED : ACCENT, fontVariant: ['tabular-nums'] }]}>
          {isExpired ? (ar ? 'انتهى' : 'Closed') : formatRemaining(remainingMs, ar)}
        </Text>
        {isCreator && !isExpired && (
          <TouchableOpacity
            onPress={() => Alert.alert(
              ar ? 'حذف التصويت؟' : 'Delete poll?', undefined,
              [
                { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
                { text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: () => onDelete(poll._id) },
              ],
            )}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginStart: 10 }}
          >
            <Text style={[card.deleteGlyph, { color: MUTED }]}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Question */}
      <Text style={[card.question, { color: TEXT, textAlign: startSide }]}>{poll.question}</Text>

      {/* Options */}
      <View style={{ marginTop: 10, gap: 6 }}>
        {poll.options.map((opt) => {
          const count = opt.count ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const mine = !!opt.mine;
          return (
            <TouchableOpacity
              key={opt._id}
              activeOpacity={isExpired ? 1 : 0.7}
              onPress={() => !isExpired && onVote(poll._id, opt._id)}
              disabled={isExpired}
              style={[card.option, { backgroundColor: mine ? ACCENT : FILL, borderColor: mine ? ACCENT : SEPARATOR }]}
            >
              {/* Fill bar */}
              <View style={[card.fillBar, { width: `${pct}%`, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : SEPARATOR, [startSide]: 0 }]} />
              <View style={[card.optionContent, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
                <Text style={[card.optionText, { color: mine ? '#fff' : TEXT }]} numberOfLines={2}>{opt.text}</Text>
                <Text style={[card.optionPct, { color: mine ? 'rgba(255,255,255,0.8)' : MUTED }]}>{pct}%</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <Text style={[card.footer, { color: MUTED, textAlign: startSide }]}>
        {total === 1 ? (ar ? 'صوت واحد' : '1 vote') : (ar ? `${total} أصوات` : `${total} votes`)}
      </Text>
    </View>
  );
}

const card = StyleSheet.create({
  card: {
    marginVertical: 8, padding: 14,
    borderRadius: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  headerRow: { alignItems: 'center' },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  typeText: { fontSize: 11, fontWeight: '500' },
  timer: { fontSize: 12, fontWeight: '600' },
  deleteGlyph: { fontSize: 22, lineHeight: 22 },
  question: { marginTop: 10, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  option: {
    minHeight: 46, marginBottom: 0, borderRadius: 12, borderWidth: 1,
    overflow: 'hidden', justifyContent: 'center',
  },
  fillBar: { position: 'absolute', top: 0, bottom: 0 },
  optionContent: { minHeight: 46, alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  optionText: { flex: 1, fontSize: 14, fontWeight: '500' },
  optionPct: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  footer: { marginTop: 10, fontSize: 12, fontWeight: '400' },
});

// ── Poll composer modal ───────────────────────────────────────────────────────
export function PollComposer({ visible, onClose, onSubmit }) {
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { ACCENT, TEXT, MUTED, BG, FILL, SEPARATOR } = useBrutColors();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState(15);

  useEffect(() => {
    if (!visible) { setQuestion(''); setOptions(['', '']); setDuration(15); }
  }, [visible]);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = !!question.trim() && filled.length >= 2;
  const startSide = ar ? 'right' : 'left';

  const submit = () => {
    if (!ready) return;
    onClose();
    onSubmit({ question: question.trim(), options: filled, durationMinutes: duration });
  };

  const updateOption = (i, v) => { const next = [...options]; next[i] = v; setOptions(next); };
  const removeOption = (i) => setOptions(options.filter((_, idx) => idx !== i));
  const addOption = () => options.length < 4 && setOptions([...options, '']);

  const durLabel = (mins) => {
    if (mins === 60) return ar ? 'ساعة' : '1h';
    return ar ? `${mins} دقيقة` : `${mins}m`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[comp.root, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BrutNav
          onBack={onClose}
          leftLabel={t('common.cancel')}
          right={
            <TouchableOpacity onPress={submit} disabled={!ready} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[comp.postLink, { color: ACCENT }, !ready && { opacity: 0.35 }]}>
                {t('radar.post')}
              </Text>
            </TouchableOpacity>
          }
        />

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 20 }}>
          {/* Question */}
          <View>
            <Text style={[comp.label, { color: MUTED, textAlign: startSide }]}>{ar ? 'السؤال' : 'Question'}</Text>
            <TextInput
              style={[comp.input, { color: TEXT, backgroundColor: FILL, borderColor: SEPARATOR, textAlign: startSide }]}
              value={question}
              onChangeText={setQuestion}
              placeholder={t('radar.questionPlaceholder')}
              placeholderTextColor={MUTED}
              maxLength={120}
            />
          </View>

          {/* Options */}
          <View>
            <Text style={[comp.label, { color: MUTED, textAlign: startSide }]}>{ar ? 'الخيارات' : 'Options'}</Text>
            <View style={{ gap: 8 }}>
              {options.map((opt, i) => (
                <View key={i} style={[comp.optionRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
                  <TextInput
                    style={[comp.input, { flex: 1, color: TEXT, backgroundColor: FILL, borderColor: SEPARATOR, textAlign: startSide }]}
                    value={opt}
                    onChangeText={(v) => updateOption(i, v)}
                    placeholder={ar ? `الخيار ${i + 1}` : `Option ${i + 1}`}
                    placeholderTextColor={MUTED}
                    maxLength={80}
                  />
                  {options.length > 2 && (
                    <TouchableOpacity onPress={() => removeOption(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={[comp.removeGlyph, { color: MUTED }]}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {options.length < 4 && (
                <TouchableOpacity onPress={addOption} style={{ alignSelf: ar ? 'flex-end' : 'flex-start' }}>
                  <Text style={[comp.addOption, { color: ACCENT }]}>
                    {ar ? '+ خيار' : '+ Add option'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Duration */}
          <View>
            <Text style={[comp.label, { color: MUTED, textAlign: startSide }]}>{ar ? 'المدة' : 'Duration'}</Text>
            <View style={[comp.durRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
              {DURATIONS.map((mins) => {
                const active = duration === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setDuration(mins)}
                    style={[comp.durChip, { backgroundColor: active ? ACCENT : FILL, borderColor: active ? ACCENT : SEPARATOR }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[comp.durChipText, { color: active ? '#fff' : MUTED }]}>{durLabel(mins)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const comp = StyleSheet.create({
  root: { flex: 1 },
  postLink: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  input: {
    fontSize: 15, fontWeight: '400',
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1,
  },
  optionRow: { alignItems: 'center', gap: 8 },
  removeGlyph: { fontSize: 22, lineHeight: 26, paddingHorizontal: 4 },
  addOption: { fontSize: 14, fontWeight: '500', paddingVertical: 4 },
  durRow: { gap: 8 },
  durChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  durChipText: { fontSize: 14, fontWeight: '500' },
});
