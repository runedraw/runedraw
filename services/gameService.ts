
import { supabase } from './supabase';
import { BoxInfo, BoxItem, SpinResult, BattleResult, BattleMode, BattleRule, RewardsState, BattleRoomData, Transaction, BattleHistoryV2Row, UnlockEntry, BattleRoll, CoinFlipEntry, CoinPackage } from '../types';
import { normalizeItemImageName } from '../constants';

/**
 * Generates a valid RFC4122 v4 UUID.
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const GameService = {
  // ... Existing methods ...
  async getBoxes(): Promise<BoxInfo[]> {
    const { data, error } = await supabase
      .from('box_info')
      .select('box_id, name, price, price_golden, image')
      .order('price', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getBoxItems(boxId: number): Promise<BoxItem[]> {
    const { data: items, error: itemsError } = await supabase.from('box_items').select('*').eq('box_id', boxId);
    if (itemsError) return [];
    
    const { data: oddsData } = await supabase.from('box_odds').select('*').eq('box_id', boxId);
    const tierMap: Record<string, string> = { 'common': 'gray', 'uncommon': 'green', 'rare': 'blue', 'epic': 'red', 'legendary': 'gold' };
    const normalizeTier = (t: string) => {
        const lower = (t || 'common').trim().toLowerCase();
        return tierMap[lower] || lower; 
    };

    const tierOddsMap: Record<string, { raw: number, golden: number }> = {};
    if (oddsData) {
        oddsData.forEach((odd: any) => {
            if (odd.tier) tierOddsMap[normalizeTier(odd.tier)] = { raw: odd.odds_raw, golden: odd.odds_golden };
        });
    }

    const processedItems = (items || []).map((item: any) => {
        const t = normalizeTier(item.tier);
        const count = items?.filter(i => normalizeTier(i.tier) === t).length || 1;
        const weights = tierOddsMap[t] || { raw: 100, golden: 100 };

        let imagePath = item.image;
        if (!imagePath && item.item_name) {
            imagePath = normalizeItemImageName(item.item_name);
        }

        return {
            item_id: item.item_id,
            name: item.item_name || 'Unknown Item',
            tier: t,
            value: item.item_value || 0,
            image: imagePath,
            weight: weights.raw / count,
            weight_golden: weights.golden / count
        };
    });
    
    return processedItems.sort((a, b) => a.value - b.value);
  },

  async getAllBoxItems(): Promise<Record<number, BoxItem[]>> {
      const { data: items } = await supabase.from('box_items').select('*');
      const { data: odds } = await supabase.from('box_odds').select('*');

      if (!items) return {};
      
      const grouped: Record<number, BoxItem[]> = {};
      const tierMap: Record<string, string> = { 'common': 'gray', 'uncommon': 'green', 'rare': 'blue', 'epic': 'red', 'legendary': 'gold' };
      const normalizeTier = (t: string) => {
        const lower = (t || 'common').trim().toLowerCase();
        return tierMap[lower] || lower; 
      };

      const oddsMap: Record<number, Record<string, { raw: number, golden: number }>> = {};
      if (odds) {
          odds.forEach((o: any) => {
              if (!oddsMap[o.box_id]) oddsMap[o.box_id] = {};
              const t = normalizeTier(o.tier);
              oddsMap[o.box_id][t] = { raw: o.odds_raw, golden: o.odds_golden };
          });
      }

      const boxTierCounts: Record<number, Record<string, number>> = {};
      items.forEach((item: any) => {
          const bid = item.box_id;
          const t = normalizeTier(item.tier);
          if (!boxTierCounts[bid]) boxTierCounts[bid] = {};
          boxTierCounts[bid][t] = (boxTierCounts[bid][t] || 0) + 1;
      });

      items.forEach((item: any) => {
          if (!grouped[item.box_id]) grouped[item.box_id] = [];
          
          let imagePath = item.image;
          if (!imagePath && item.item_name) {
              imagePath = normalizeItemImageName(item.item_name);
          }

          const t = normalizeTier(item.tier);
          const count = boxTierCounts[item.box_id]?.[t] || 1;
          const boxOdds = oddsMap[item.box_id]?.[t] || { raw: 100, golden: 100 };

          grouped[item.box_id].push({
            item_id: item.item_id,
            name: item.item_name || 'Unknown Item',
            tier: t,
            value: item.item_value || 0,
            image: imagePath,
            weight: boxOdds.raw / count,
            weight_golden: boxOdds.golden / count
        });
      });
      return grouped;
  },

  async getUserData(userId: string) {
    const { data: user, error } = await supabase.from('user_data').select('*').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    
    const { data: xpData } = await supabase.from('xp_transactions').select('amount').eq('user_id', userId);
    const totalXp = xpData ? xpData.reduce((sum, row) => sum + (row.amount || 0), 0) : 0;

    if (!user) {
         const { data: newData } = await supabase.from('user_data').insert([{ id: userId, balance: 10000 }]).select().single();
         return { ...newData, wagered_xp: 0 };
    }
    
    return { ...user, wagered_xp: totalXp };
  },

  async getActiveBattles(): Promise<BattleRoomData[]> {
    const { data, error } = await supabase
      .from('pending_battles')
      .select('*')
      .in('status', ['waiting', 'running'])
      .order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
  },

  async getBattleRoom(battleId: number): Promise<BattleRoomData | null> {
    const { data, error } = await supabase.from('pending_battles').select('*').eq('id', battleId).single();
    if (error) return null;
    return data;
  },

  async createBattleRoom(cartNames: string[], cost: number, mode: BattleMode, rule: BattleRule, jackpot: boolean, userId: string, email: string): Promise<number> {
    const maxPlayers = this.getPlayerCountFromMode(mode);
    const userData = await this.getUserData(userId);
    if (userData.balance < cost) throw new Error("Insufficient balance to create battle.");
    
    const newBalance = userData.balance - cost;
    const { error: balError } = await supabase.from('user_data').update({ balance: newBalance }).eq('id', userId);
    if (balError) throw new Error("Failed to update balance");

    const { data, error } = await supabase.from('pending_battles').insert([{
        creator_id: userId,
        boxes: cartNames,
        cost_per_player: cost,
        mode: mode,
        rule: rule,
        jackpot_enabled: jackpot,
        max_players: maxPlayers,
        status: 'waiting',
        players: [{ id: userId, email: email, is_bot: false, team_index: 0 }],
        created_at: new Date().toISOString()
    }]).select().single();
    
    if (error) throw new Error(error.message);
    const battleId = data.id;

    await supabase.from('transaction_history').insert({
        user_id: userId,
        amount: -cost,
        source: 'BATTLE_ENTRY',
        balance: newBalance, 
        created_at: new Date().toISOString(),
        related_id: battleId
    });

    await supabase.from('xp_transactions').insert({
        user_id: userId,
        amount: cost,
        reference_type: 'battle_creation',
        reference_id: battleId,
        created_at: new Date().toISOString()
    });

    return battleId;
  },

  async joinBattle(battleId: number, userId: string, email: string, cost: number): Promise<void> {
    const userData = await this.getUserData(userId);
    if (userData.balance < cost) throw new Error("Insufficient balance to join battle.");
    
    const newBalance = userData.balance - cost;
    const { error: balError } = await supabase.from('user_data').update({ balance: newBalance }).eq('id', userId);
    if (balError) throw new Error("Failed to update balance");

    const { data, error } = await supabase.rpc('join_battle_multiplayer', {
        p_battle_id: battleId,
        p_user_id: userId,
        p_email: email
    });
    if (error) throw new Error(this.stringifyError(error));

    await supabase.from('transaction_history').insert({
        user_id: userId,
        amount: -cost,
        source: 'BATTLE_ENTRY',
        balance: newBalance,
        created_at: new Date().toISOString(),
        related_id: battleId
    });

    try {
        await supabase.from('xp_transactions').insert({
            user_id: userId,
            amount: cost,
            reference_type: 'battle_join',
            reference_id: battleId,
            created_at: new Date().toISOString()
        });
    } catch(e) { console.error("XP Error", e); }
  },

  async addBotToBattle(battleId: number): Promise<void> {
    const room = await this.getBattleRoom(battleId);
    if (!room) return;
    if (room.players.length >= room.max_players) throw new Error("Battle room is full.");

    const botId = generateUUID();
    let teamCount = 2;
    if (room.mode === '1v1v1') teamCount = 3;
    else if (room.mode === '1v1v1v1') teamCount = 4;
    else if (room.mode === '2v2v2') teamCount = 3;
    const teamIndex = room.players.length % teamCount;
    
    const newPlayers = [...room.players, { id: botId, email: 'Synthetic_AI', is_bot: true, team_index: teamIndex }];
    const { error } = await supabase.from('pending_battles').update({ players: newPlayers }).eq('id', battleId);
    if (error) throw new Error(error.message);
  },

  async finalizeBattle(battleId: number): Promise<BattleResult> {
    const { data, error } = await supabase.rpc('execute_multiplayer_battle', { p_pending_id: battleId });
    if (error) throw new Error(this.stringifyError(error));
    
    const resultData = Array.isArray(data) ? data[0] : data;
    if (resultData && resultData.error && resultData.error !== 'already_processed') throw new Error(resultData.error);
    
    try {
        const fullResult = await this.getBattleResult(battleId);
        return fullResult.result;
    } catch (e) {
        await new Promise(r => setTimeout(r, 800));
        const retryResult = await this.getBattleResult(battleId);
        return retryResult.result;
    }
  },

  stringifyError(error: any): string {
      if (!error) return "Unknown Error";
      if (typeof error === 'string') return error;
      if (error.message) return error.message;
      return String(error);
  },

  getPlayerCountFromMode(mode: BattleMode): number {
    const map: Record<string, number> = { '1v1': 2, '1v1v1': 3, '1v1v1v1': 4, '2v2': 4, '2v2v2': 6, '3v3': 6 };
    return map[mode] || 2;
  },

  async getBattleHistory(userId?: string): Promise<any[]> {
    let query = supabase.from('battle_history_v2').select('*').order('created_at', { ascending: false }).limit(500);
    if (userId) query = query.eq('user_id', userId);
    const { data: rawRows, error } = await query;
    if (error) return [];

    const battleMap = new Map<number, any>();
    (rawRows as BattleHistoryV2Row[]).forEach(row => {
        if (!battleMap.has(row.battle_id)) {
            battleMap.set(row.battle_id, {
                battle_id: row.battle_id,
                created_at: row.created_at,
                completed_at: row.created_at,
                mode: row.mode,
                rule: row.rule,
                total_pot: row.total_pot,
                winner_team_id: row.winner_team_id,
                is_draw: row.is_draw,
                total_payout: 0,
                is_winner: false,
                user_battle_id: `${row.battle_id}-${userId || 'global'}`
            });
        }
        const battle = battleMap.get(row.battle_id);
        if (userId && row.user_id === userId) {
            battle.total_payout = row.payout;
            if (row.payout > 0 && !row.is_draw) battle.is_winner = true;
        }
    });
    return Array.from(battleMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getBattleResult(id: number) {
      const { data: rows, error } = await supabase.from('battle_history_v2').select('*').eq('battle_id', id).order('round_index', { ascending: true }).order('player_index', { ascending: true });
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new Error("Battle data not found");

      const typedRows = rows as BattleHistoryV2Row[];
      const firstRow = typedRows[0];
      const uniqueRounds = [...new Set(typedRows.map(r => r.round_index))].sort((a,b) => a - b);
      const boxes = uniqueRounds.map(rIdx => typedRows.find(r => r.round_index === rIdx)?.box_name || 'Unknown Box');

      const roundsMap = new Map<number, any>();
      const playerTeamsMap = new Map<number, number>();

      typedRows.forEach(row => {
          playerTeamsMap.set(row.player_index, row.team_index);
          if (!roundsMap.has(row.round_index)) roundsMap.set(row.round_index, { box_name: row.box_name, rolls: [] });
          roundsMap.get(row.round_index).rolls.push({
              player_index: row.player_index,
              item_name: row.item_name,
              item_value: row.item_value,
              tier: row.item_tier,
              item_id: row.item_id,
              user_id: row.user_id
          });
      });

      const maxPlayerIndex = Math.max(...Array.from(playerTeamsMap.keys()));
      const playerTeams: number[] = [];
      for(let i=0; i<=maxPlayerIndex; i++) playerTeams.push(playerTeamsMap.get(i) ?? 0);

      const maxTeamIndex = Math.max(...playerTeams);
      const teamScores = new Array(maxTeamIndex + 1).fill(0);
      typedRows.forEach(row => { if (row.team_index <= maxTeamIndex) teamScores[row.team_index] += row.item_value; });

      return {
          result: {
            battle_id: firstRow.battle_id,
            pending_battle_id: firstRow.battle_id,
            winner_team_id: firstRow.winner_team_id,
            total_pot: firstRow.total_pot,
            player_teams: playerTeams,
            rounds: Array.from(roundsMap.values()),
            team_scores: teamScores,
            jackpot_enabled: firstRow.jackpot_enabled,
            completed_at: firstRow.created_at,
            is_draw: firstRow.is_draw
          },
          boxes: boxes,
          mode: firstRow.mode,
          rule: firstRow.rule,
          jackpot_enabled: firstRow.jackpot_enabled,
          battle_id: firstRow.battle_id,
          pending_battle_id: firstRow.battle_id,
          creator_id: ''
      };
  },

  async getRewardsState(): Promise<RewardsState> {
      const { data, error } = await supabase.rpc('get_rewards_state');
      if (error) throw new Error(error.message);
      return data;
  },

  async claimDailyReward(boxId: number): Promise<SpinResult> {
      const { data, error } = await supabase.rpc('claim_daily_reward', { p_box_id: boxId });
      if (error) throw new Error(error.message);
      return data;
  },

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    const { data } = await supabase.from('transaction_history').select('id:transaction_id, amount, source, balance, created_at').eq('user_id', userId).neq('source', 'battle_refund_draw').order('created_at', { ascending: false }).limit(100);
    return data || [];
  },

  async getSoloHistory(userId: string) {
    const { data } = await supabase.from('solo_box_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    return data || [];
  },

  async cancelBattle(battleId: number): Promise<void> {
    const { data: deletedBattle, error: deleteError } = await supabase.from('pending_battles').delete().eq('id', battleId).select().single();
    if (deleteError) throw new Error("Failed to cancel battle: " + deleteError.message);
    if (!deletedBattle) throw new Error("Battle not found or already cancelled.");

    const refundAmount = deletedBattle.cost_per_player;
    const refundPromises = deletedBattle.players.map(async (player: any) => {
        if (player.is_bot) return;
        try {
            const { data: userData } = await supabase.from('user_data').select('balance').eq('id', player.id).single();
            if (userData) {
                const newBalance = userData.balance + refundAmount;
                await supabase.from('user_data').update({ balance: newBalance }).eq('id', player.id);
                await supabase.from('transaction_history').insert({
                    user_id: player.id,
                    amount: refundAmount,
                    source: 'BATTLE_REFUND',
                    balance: newBalance,
                    created_at: new Date().toISOString()
                });
            }
        } catch (e) { console.error(`Failed to refund player ${player.id}`, e); }
    });
    await Promise.all(refundPromises);
  },

  async spinSoloBox(boxId: number, isGolden: boolean, spinCount: number = 1) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not logged in");

    const promises = Array.from({ length: spinCount }).map(() => supabase.rpc('spin_solo_box', { p_box_id: boxId, p_is_golden: isGolden }));
    const results = await Promise.all(promises);
    const spinResults = results.map(r => r.data).flat();
    
    if (spinResults.length > 0) {
        setTimeout(() => { this.processSoloUnlocks(user.id, boxId, spinResults); }, 500);
    }
    return spinResults;
  },

  async getUnlockedItems(userId: string): Promise<UnlockEntry[]> {
      const { data, error } = await supabase.from('user_item_unlocks').select('*').eq('user_id', userId);
      if (error) return [];
      return data as UnlockEntry[];
  },

  async processSoloUnlocks(userId: string, boxId: number, results: any[]) {
      try {
        const rawUnlocks = [];
        for (const r of results) {
            const itemName = r.item_name || r.ItemName || r.name || r.Name;
            const itemTier = (r.tier || r.Tier || 'common').toLowerCase();
            if (!itemName) continue;

            let relatedId = r.id;
            if (!relatedId) {
                const { data: history } = await supabase.from('solo_box_history').select('id').eq('user_id', userId).eq('item_name', itemName).order('created_at', { ascending: false }).limit(1).maybeSingle();
                if (history) relatedId = history.id;
            }

            rawUnlocks.push({ user_id: userId, item_name: itemName, item_tier: itemTier, box_id: boxId, source_type: 'solo', related_id: relatedId || null, created_at: new Date().toISOString() });
        }
        
        const uniqueUnlocksMap = new Map();
        for (const u of rawUnlocks) uniqueUnlocksMap.set(u.item_name, u); 
        const finalUnlocks = Array.from(uniqueUnlocksMap.values());

        if (finalUnlocks.length > 0) {
            await supabase.from('user_item_unlocks').upsert(finalUnlocks, { onConflict: 'user_id, item_name' });
        }
      } catch(e) { console.error("Unlock Error", e); }
  },

  async checkAndUnlockBattleItems(userId: string, battleId: number, attempt = 1) {
      const { data: history, error } = await supabase.from('battle_history_v2').select('*').eq('battle_id', battleId);
      if ((error || !history || history.length === 0) && attempt < 2) {
          setTimeout(() => this.checkAndUnlockBattleItems(userId, battleId, attempt + 1), 1000);
          return;
      }
      if (!history || history.length === 0) return;

      const userRow = (history as BattleHistoryV2Row[]).find(r => r.user_id === userId);
      if (!userRow) return; 
      const myTeam = userRow.team_index;
      const teamHits = (history as BattleHistoryV2Row[]).filter(r => r.team_index === myTeam);
      if (teamHits.length === 0) return;

      const { data: allItems } = await supabase.from('box_items').select('item_id, box_id, item_name, tier');
      const itemMap = new Map<string, { name: string, boxId: number, tier: string }>();
      if (allItems) {
          allItems.forEach((i: any) => {
              if (i.item_name) itemMap.set(i.item_name.toLowerCase(), { name: i.item_name, boxId: i.box_id, tier: i.tier || 'common' });
          });
      }

      const teamUnlocks: any[] = [];
      teamHits.forEach(hit => {
          const rawName = hit.item_name || '';
          if (!rawName) return;
          if (!hit.id) return;

          const canonical = itemMap.get(rawName.toLowerCase());
          const unlockEntry: any = { user_id: userId, source_type: 'battle', related_id: hit.id };

          if (canonical) {
              unlockEntry.item_name = canonical.name;
              unlockEntry.item_tier = canonical.tier.toLowerCase();
              unlockEntry.box_id = canonical.boxId;
              teamUnlocks.push(unlockEntry);
          } else if (hit.box_id) {
               unlockEntry.item_name = hit.item_name;
               unlockEntry.item_tier = (hit.item_tier || 'common').toLowerCase();
               unlockEntry.box_id = hit.box_id;
               teamUnlocks.push(unlockEntry);
          }
      });

      if (teamUnlocks.length > 0) {
          const uniqueMap = new Map();
          teamUnlocks.forEach(item => uniqueMap.set(item.item_name.toLowerCase(), item));
          await supabase.from('user_item_unlocks').upsert(Array.from(uniqueMap.values()), { onConflict: 'user_id, item_name' });
      }
  },

  async getClaimedCollectionRewards(userId: string): Promise<number[]> {
      const { data } = await supabase.from('user_collection_rewards').select('box_id').eq('user_id', userId);
      if (!data) return [];
      return data.map(r => r.box_id);
  },

  async claimCollectionReward(userId: string, boxId: number, rewardAmount: number): Promise<void> {
    const allBoxItems = await this.getBoxItems(boxId);
    const unlocked = await this.getUnlockedItems(userId);
    const unlockedNames = new Set(unlocked.map(u => u.item_name));
    if (!allBoxItems.every(i => unlockedNames.has(i.name))) throw new Error("Collection not complete.");

    const { data: existing } = await supabase.from('user_collection_rewards').select('id').match({ user_id: userId, box_id: boxId });
    if (existing && existing.length > 0) throw new Error("Reward already claimed.");

    const userData = await this.getUserData(userId);
    const newBalance = userData.balance + rewardAmount;
    const { error: balError } = await supabase.from('user_data').update({ balance: newBalance }).eq('id', userId);
    if (balError) throw new Error("Balance update failed");

    await supabase.from('transaction_history').insert({ user_id: userId, amount: rewardAmount, source: 'COLLECTION_REWARD', balance: newBalance, created_at: new Date().toISOString(), related_id: boxId });
    await supabase.from('user_collection_rewards').insert({ user_id: userId, box_id: boxId, reward_amount: rewardAmount });
  },

  async flipCoin(userId: string, wager: number, chosenSide: 'heads' | 'tails'): Promise<CoinFlipEntry> {
      const userData = await this.getUserData(userId);
      if (userData.balance < wager) throw new Error("Insufficient balance.");

      const isHeads = Math.random() < 0.5;
      const outcome = isHeads ? 'heads' : 'tails';
      const won = chosenSide === outcome;
      const payout = won ? wager * 2 : 0;
      const netChange = won ? wager : -wager; 

      const newBalance = userData.balance + netChange;
      const { error: balError } = await supabase.from('user_data').update({ balance: newBalance }).eq('id', userId);
      if (balError) throw new Error("Failed to update balance");

      await supabase.from('transaction_history').insert({ user_id: userId, amount: netChange, source: 'COIN_FLIP', balance: newBalance, created_at: new Date().toISOString() });

      const historyEntry = { user_id: userId, wager, chosen_side: chosenSide, outcome, won, payout, created_at: new Date().toISOString() };
      const { data: entryData } = await supabase.from('coin_flip_history').insert(historyEntry).select().single();

      try {
          await supabase.from('xp_transactions').insert({ user_id: userId, amount: wager, reference_type: 'coin_flip', reference_id: entryData?.id, created_at: new Date().toISOString() });
      } catch(e) { console.error("XP error", e); }

      return entryData || { ...historyEntry, id: 0 } as CoinFlipEntry;
  },

  async getCoinFlipHistory(userId: string): Promise<CoinFlipEntry[]> {
      const { data } = await supabase.from('coin_flip_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
      return data || [];
  },

  // --- NEW ARCADE HELPERS ---
  
  // Generic helper for atomic games (Dice, Wheel, Plinko)
  async arcadeAtomicTx(userId: string, gameCode: string, wager: number, payout: number, metadata: any = {}) {
      const userData = await this.getUserData(userId);
      if (userData.balance < wager) throw new Error("Insufficient balance.");

      const netChange = payout - wager;
      const newBalance = userData.balance + netChange;

      const { error: balError } = await supabase.from('user_data').update({ balance: newBalance }).eq('id', userId);
      if (balError) throw new Error("Balance Update Failed");

      // Record transaction
      const { data: txData } = await supabase.from('transaction_history').insert({
          user_id: userId,
          amount: netChange,
          source: gameCode.toUpperCase(),
          balance: newBalance,
          created_at: new Date().toISOString()
      }).select().single();

      // Attempt to save to generic history table if it exists, otherwise metadata in transaction is lost but balance is safe
      try {
          await supabase.from('arcade_history').insert({
              user_id: userId,
              game_type: gameCode,
              wager: wager,
              payout: payout,
              metadata: metadata,
              created_at: new Date().toISOString()
          });
      } catch (e) { 
          // If table doesn't exist, we just ignore history logging, but money is safe.
      }

      // Award XP
      try {
          await supabase.from('xp_transactions').insert({
              user_id: userId,
              amount: wager,
              reference_type: 'arcade',
              reference_id: txData?.id, // Link to transaction ID as fallback
              created_at: new Date().toISOString()
          });
      } catch(e) {}

      return { newBalance, success: true };
  },

  // Helpers for multi-step games (Mines, Tower)
  async arcadeDeduct(userId: string, gameCode: string, amount: number) {
      const userData = await this.getUserData(userId);
      if (userData.balance < amount) throw new Error("Insufficient balance.");
      const newBalance = userData.balance - amount;
      
      const { error: balError } = await supabase.from('user_data').update({ balance: newBalance }).eq('id', userId);
      if (balError) throw new Error("Deduct Failed");

      await supabase.from('transaction_history').insert({
          user_id: userId,
          amount: -amount,
          source: `${gameCode.toUpperCase()}_BET`,
          balance: newBalance,
          created_at: new Date().toISOString()
      });
      
      // Award XP on bet
      try {
          await supabase.from('xp_transactions').insert({
              user_id: userId,
              amount: amount,
              reference_type: 'arcade_bet',
              created_at: new Date().toISOString()
          });
      } catch(e) {}

      return newBalance;
  },

  async arcadePayout(userId: string, gameCode: string, amount: number) {
      if (amount <= 0) return;
      const userData = await this.getUserData(userId);
      const newBalance = userData.balance + amount;

      const { error: balError } = await supabase.from('user_data').update({ balance: newBalance }).eq('id', userId);
      if (balError) throw new Error("Payout Failed");

      await supabase.from('transaction_history').insert({
          user_id: userId,
          amount: amount,
          source: `${gameCode.toUpperCase()}_WIN`,
          balance: newBalance,
          created_at: new Date().toISOString()
      });
      return newBalance;
  },

  // --- TOP UP / DAILY COIN SYSTEM ---

  async getDailyCoinStatus(userId: string): Promise<{ ready: boolean, remainingMs: number }> {
      const { data } = await supabase
        .from('transaction_history')
        .select('created_at')
        .eq('user_id', userId)
        .eq('source', 'DAILY_ALLOWANCE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return { ready: true, remainingMs: 0 };
      
      const lastClaim = new Date(data.created_at).getTime();
      const now = Date.now();
      const cooldown = 24 * 60 * 60 * 1000;
      const diff = (lastClaim + cooldown) - now;
      
      if (diff > 0) return { ready: false, remainingMs: diff };
      return { ready: true, remainingMs: 0 };
  },

  // Secure Backend Claim via RPC
  async claimDailyCoins(userId: string): Promise<number> {
      const { data, error } = await supabase.rpc('claim_daily_allowance');
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.message || "Daily cooldown active.");
      return data.new_balance;
  },

  // Stripe Checkout Initiation
  async initiateStripeCheckout(userId: string, packageId: string): Promise<string> {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: { packageId }
      });
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error("Failed to create payment session");
      return data.url;
  }
};