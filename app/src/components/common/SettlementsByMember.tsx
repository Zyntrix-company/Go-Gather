import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, CircleArrowDown, CircleArrowUp } from 'lucide-react-native';
import type { Debt } from '../../api/trips.api';
import type { MemberRosterEntry } from '../../utils/expenseTotals';
import { formatCurrencyFull } from '../../utils/currency';
import CachedImage from './CachedImage';
import { typeStyle } from '../../theme/typography';

type Props = {
  debts: Debt[];
  roster: MemberRosterEntry[];
  currentUserId: string;
  onSettle: (fromUserId: string, toUserId: string, amount: number, currency: string, fromName: string, toName: string) => void;
  settlingDebtKey?: string | null;
};

type Direction = 'receive' | 'pay';

/**
 * Group-wide settlements ledger, one accordion card per member. Expanding a
 * member shows every settlement that touches them (To Receive / To Pay) —
 * not just the ones involving the current user. Settle is actionable on any
 * row, so any member can record a payment on behalf of the two parties involved.
 */
export default function SettlementsByMember({ debts, roster, currentUserId, onSettle, settlingDebtKey }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const avatarByUserId = new Map(roster.map(r => [r.userId, r.avatarUrl ?? null]));

  const members = roster
    .map(member => ({
      member,
      toReceive: debts.filter(d => d.to === member.userId),
      toPay: debts.filter(d => d.from === member.userId),
    }))
    .filter(entry => entry.toReceive.length + entry.toPay.length > 0);

  if (members.length === 0) return null;

  const toggle = (userId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const renderRow = (debt: Debt, direction: Direction) => {
    const otherId = direction === 'receive' ? debt.from : debt.to;
    const otherName = direction === 'receive' ? debt.fromName : debt.toName;
    const avatarUrl = avatarByUserId.get(otherId);
    const initial = otherName ? otherName[0].toUpperCase() : '?';
    const debtKey = `${debt.from}|${debt.to}|${debt.currency}`;
    const isSettling = settlingDebtKey === debtKey;
    const isReceive = direction === 'receive';

    return (
      <View key={`${otherId}-${debt.currency}-${direction}`} style={local.row}>
        <View style={local.rowAvatarBox}>
          {avatarUrl ? (
            <CachedImage uri={avatarUrl} style={local.rowAvatarImg} resizeMode="cover" priority="normal" />
          ) : (
            <Text style={local.rowAvatarInitial}>{initial}</Text>
          )}
        </View>
        <Text style={local.rowName} numberOfLines={1}>
          {otherName || 'Member'}
        </Text>
        <Text style={local.rowAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {formatCurrencyFull(debt.amount, debt.currency)}
        </Text>
        <View style={[local.currencyPill, isReceive ? local.pillReceive : local.pillPay]}>
          <Text style={[local.currencyPillText, isReceive ? local.textReceive : local.textPay]}>
            {debt.currency}
          </Text>
        </View>
        <TouchableOpacity
          style={[local.settleBtn, settlingDebtKey != null && { opacity: isSettling ? 0.6 : 0.4 }]}
          onPress={() => onSettle(debt.from, debt.to, debt.amount, debt.currency, debt.fromName, debt.toName)}
          disabled={settlingDebtKey != null}
          activeOpacity={0.85}>
          <Text style={local.settleBtnText}>{isSettling ? 'Settling…' : 'Settle'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View>
      <Text style={local.sectionLabel}>Settlements</Text>

      {members.map(({ member, toReceive, toPay }) => {
        const isExpanded = expandedIds.has(member.userId);
        const initial = member.name ? member.name[0].toUpperCase() : '?';
        const count = toReceive.length + toPay.length;

        return (
          <View key={member.userId} style={local.card}>
            <TouchableOpacity
              style={local.cardHeader}
              onPress={() => toggle(member.userId)}
              activeOpacity={0.7}>
              <View style={local.avatarBox}>
                {member.avatarUrl ? (
                  <CachedImage uri={member.avatarUrl} style={local.avatarImg} resizeMode="cover" priority="normal" />
                ) : (
                  <Text style={local.avatarInitial}>{initial}</Text>
                )}
              </View>
              <View style={local.cardHeaderBody}>
                <Text style={local.memberName} numberOfLines={1}>
                  {member.name}
                </Text>
                <Text style={local.memberMeta}>
                  {count} settlement{count !== 1 ? 's' : ''}
                </Text>
              </View>
              {isExpanded ? (
                <ChevronUp size={18} color="#0d9488" strokeWidth={2} />
              ) : (
                <ChevronDown size={18} color="#94a3b8" strokeWidth={2} />
              )}
            </TouchableOpacity>

            {isExpanded && (
              <View style={local.cardExpanded}>
                {toReceive.length > 0 && (
                  <View style={local.subSection}>
                    <View style={local.subHeader}>
                      <CircleArrowDown size={14} color="#16a34a" strokeWidth={2} />
                      <Text style={[local.subHeaderText, local.textReceive]}>To Receive</Text>
                    </View>
                    {toReceive.map(d => renderRow(d, 'receive'))}
                  </View>
                )}
                {toPay.length > 0 && (
                  <View style={local.subSection}>
                    <View style={local.subHeader}>
                      <CircleArrowUp size={14} color="#e11d48" strokeWidth={2} />
                      <Text style={[local.subHeaderText, local.textPay]}>To Pay</Text>
                    </View>
                    {toPay.map(d => renderRow(d, 'pay'))}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  sectionLabel: typeStyle('expSectionHeading', { color: '#0f172a', marginBottom: 10 }),
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdf9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0d9488',
  },
  cardHeaderBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  memberName: typeStyle('expBreakdownRow', { color: '#0d9488' }),
  memberMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  cardExpanded: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  subSection: {
    marginBottom: 10,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  subHeaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  rowAvatarBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f0fdf9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  rowAvatarImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  rowAvatarInitial: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0d9488',
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '400',
    color: '#0f172a',
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0f172a',
    flexShrink: 0,
  },
  currencyPill: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  pillReceive: {
    backgroundColor: '#f0fdf4',
  },
  pillPay: {
    backgroundColor: '#fff1f2',
  },
  currencyPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  textReceive: {
    color: '#16a34a',
  },
  textPay: {
    color: '#e11d48',
  },
  settleBtn: {
    borderWidth: 1,
    borderColor: '#0d9488',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  settleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0d9488',
  },
});
