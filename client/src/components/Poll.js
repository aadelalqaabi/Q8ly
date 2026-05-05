/**
 * Flash Poll — display + composer.
 * Brutalist aesthetic, full RTL/LTR alignment, accent only on active state.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, Modal, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrutColors, isAr, ls, shout, BrutNav, BrutHero, BrutRule } from './Brut';

const DURATIONS = [15, 30, 60];

function formatRemaining(remainingMs, ar) {
  const seconds = Math.max(0, Math.round(remainingMs / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 1) return `${m}:${String(s).padStart(2, '0')}`;
  return ar ? `${s} ث` : `${s}s`;
}

// ── Poll card (display + vote) ─────────────────────────────────────────────
export function PollCard({ poll, onVote, onDelete, currentUserId, ar }) {
  const { ACCENT, TEXT, MUTED, SEPARATOR, FILL, BG } = useBrutColors();

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
    <View style={[card.card, { borderColor: TEXT, backgroundColor: BG }]}>
      {/* Header */}
      <View style={[card.headerRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <View style={[card.tagWrap, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          <View style={[card.tagDot, { backgroundColor: ACCENT }]} />
          <Text style={[card.tag, { color: ACCENT, letterSpacing: ls(2, ar) }]}>
            {shout(ar ? 'تصويت' : 'Poll', ar)}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[card.timer, { color: isExpired ? MUTED : TEXT }]}>
          {isExpired ? (ar ? 'انتهى' : 'CLOSED') : formatRemaining(remainingMs, ar)}
        </Text>
        {isCreator && !isExpired && (
          <TouchableOpacity
            onPress={() => Alert.alert(
              ar ? 'حذف التصويت؟' : 'Delete poll?',
              undefined,
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
      <View style={{ marginTop: 12 }}>
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
              style={[card.option, { borderColor: mine ? ACCENT : SEPARATOR }]}
            >
              <View style={[card.fill, { width: `${pct}%`, backgroundColor: mine ? ACCENT : FILL, [startSide]: 0 }]} />
              <View style={[card.optionContent, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
                <Text style={[card.optionText, { color: mine ? '#fff' : TEXT, textAlign: startSide }]} numberOfLines={2}>
                  {opt.text}
                </Text>
                <Text style={[card.optionPct, { color: mine ? '#fff' : TEXT }]}>{pct}%</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <Text style={[card.footer, { color: MUTED, letterSpacing: ls(1.5, ar), textAlign: startSide }]}>
        {total === 1 ? (ar ? 'صوت واحد' : '1 VOTE') : (ar ? `${total} أصوات` : `${total} VOTES`)}
      </Text>
    </View>
  );
}

const card = StyleSheet.create({
  card: { marginVertical: 10, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 2 },
  headerRow: { alignItems: 'center' },
  tagWrap: { alignItems: 'center', gap: 6 },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tag: { fontSize: 10, fontWeight: '900' },
  timer: { fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  deleteGlyph: { fontSize: 24, fontWeight: '900', lineHeight: 24 },
  question: { marginTop: 12, fontSize: 18, fontWeight: '900', lineHeight: 24 },
  option: { minHeight: 52, marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, bottom: 0 },
  optionContent: { minHeight: 52, alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  optionText: { flex: 1, fontSize: 15, fontWeight: '700' },
  optionPct: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  footer: { marginTop: 10, fontSize: 10, fontWeight: '800' },
});

// ── Composer modal ─────────────────────────────────────────────────────────
export function PollComposer({ visible, onClose, onSubmit }) {
  const { t, i18n } = useTranslation();
  const ar = isAr(i18n);
  const { ACCENT, TEXT, MUTED, BG } = useBrutColors();

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
    if (mins === 60) return ar ? 'ساعة' : '1H';
    return ar ? `${mins} دقيقة` : `${mins}M`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[comp.root, { backgroundColor: BG }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BrutNav
          onBack={onClose}
          leftLabel={t('common.cancel')}
          right={
            <TouchableOpacity onPress={submit} disabled={!ready} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[comp.postLink, { color: ACCENT }, !ready && { opacity: 0.35 }, { letterSpacing: ls(2, ar) }]}>
                {shout(t('radar.post'), ar)}
              </Text>
            </TouchableOpacity>
          }
        />

        <View style={{ paddingHorizontal: 24 }}>
          <BrutHero title={ar ? 'تصويت سريع' : t('radar.flashPoll')} label={ar ? 'تصويت مؤقت' : 'TEMPORARY VOTE'} size={42} />
          <BrutRule mt={20} mb={24} />

          {/* Question */}
          <Text style={[comp.label, { color: MUTED, letterSpacing: ls(2, ar), textAlign: startSide }]}>
            {shout(t('radar.question'), ar)}
          </Text>
          <TextInput
            style={[comp.input, { color: TEXT, borderBottomColor: TEXT, textAlign: startSide }]}
            value={question}
            onChangeText={setQuestion}
            placeholder={t('radar.questionPlaceholder')}
            placeholderTextColor={MUTED}
            maxLength={120}
          />

          {/* Options */}
          <Text style={[comp.label, { color: MUTED, letterSpacing: ls(2, ar), textAlign: startSide, marginTop: 24 }]}>
            {shout(t('radar.options'), ar)}
          </Text>
          {options.map((opt, i) => (
            <View key={i} style={[comp.optionRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
              <TextInput
                style={[comp.input, comp.optionInput, { color: TEXT, borderBottomColor: TEXT, textAlign: startSide }]}
                value={opt}
                onChangeText={(v) => updateOption(i, v)}
                placeholder={ar ? `الخيار ${i + 1}` : `Option ${i + 1}`}
                placeholderTextColor={MUTED}
                maxLength={80}
              />
              {options.length > 2 && (
                <TouchableOpacity onPress={() => removeOption(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={comp.removeBtn}>
                  <Text style={[comp.removeGlyph, { color: MUTED }]}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {options.length < 4 && (
            <TouchableOpacity onPress={addOption} style={{ alignSelf: ar ? 'flex-end' : 'flex-start', paddingVertical: 10 }}>
              <Text style={[comp.addOption, { color: ACCENT, letterSpacing: ls(2, ar) }]}>
                {ar ? '+ خيار آخر' : '+ ADD OPTION'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Duration */}
          <Text style={[comp.label, { color: MUTED, letterSpacing: ls(2, ar), textAlign: startSide, marginTop: 24 }]}>
            {shout(ar ? 'المدة' : 'duration', ar)}
          </Text>
          <View style={[comp.durRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
            {DURATIONS.map((mins) => {
              const active = duration === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  onPress={() => setDuration(mins)}
                  style={[comp.durChip, { borderColor: TEXT }, active && { backgroundColor: TEXT }]}
                  activeOpacity={0.7}
                >
                  <Text style={[comp.durChipText, { color: active ? BG : TEXT }]}>{durLabel(mins)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const comp = StyleSheet.create({
  root: { flex: 1 },
  postLink: { fontSize: 12, fontWeight: '900' },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 8 },
  input: { fontSize: 18, fontWeight: '700', paddingVertical: 10, borderBottomWidth: 2 },
  optionRow: { alignItems: 'center', gap: 8, marginBottom: 4 },
  optionInput: { flex: 1 },
  removeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  removeGlyph: { fontSize: 26, fontWeight: '900', lineHeight: 26 },
  addOption: { fontSize: 12, fontWeight: '900' },
  durRow: { gap: 8, marginTop: 6 },
  durChip: { paddingHorizontal: 18, paddingVertical: 10, borderWidth: 2 },
  durChipText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});
