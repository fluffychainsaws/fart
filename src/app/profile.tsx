import { useMemo } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { Text } from '@/lib/AppText';
import { signOut, useSession } from '@/lib/auth';
import { getProfilePhoto, setProfilePhoto, useProfilePhoto } from '@/lib/profilePhoto';
import { accountsEnabled } from '@/lib/supabase';
import { useCardShadow, useTheme, type Theme } from '@/lib/theme';

export default function ProfileScreen() {
  const t = useTheme();
  const shadow = useCardShadow();
  const styles = useMemo(() => makeStyles(t, shadow), [t, shadow]);
  const session = useSession();
  const photo = useProfilePhoto();

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      const msg = 'FART needs photo access to set a profile picture.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Photo access needed', msg);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) return;
    const mimeType = asset.mimeType ?? 'image/jpeg';
    await setProfilePhoto(`data:${mimeType};base64,${asset.base64}`);
  };

  const removePhoto = () => {
    const msg = 'Remove your profile photo?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) setProfilePhoto(null);
      return;
    }
    Alert.alert('Remove photo', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setProfilePhoto(null) },
    ]);
  };

  const initial = (session?.user.email ?? '?').charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <Pressable onPress={pickPhoto} accessibilityLabel="Change profile photo">
          {photo || getProfilePhoto() ? (
            <Image source={{ uri: photo ?? getProfilePhoto() ?? undefined }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Text style={styles.avatarBadgeText}>📷</Text>
          </View>
        </Pressable>
        <Pressable onPress={pickPhoto}>
          <Text style={styles.avatarLink}>{photo ? 'Change photo' : 'Add a photo'}</Text>
        </Pressable>
        {photo && (
          <Pressable onPress={removePhoto}>
            <Text style={styles.avatarRemoveLink}>Remove photo</Text>
          </Pressable>
        )}
      </View>

      {!accountsEnabled ? (
        <View style={styles.card}>
          <Text style={styles.blurb}>
            Accounts aren&apos;t configured in this build. Everything still works — your scripts
            stay saved on this device.
          </Text>
        </View>
      ) : session ? (
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email}>{session.user.email}</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => signOut()}>
            <Text style={styles.buttonText}>Sign out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.blurb}>Sign in to keep your scripts and plan across devices.</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => router.push('/login')}>
            <Text style={styles.buttonText}>Sign in / Create account</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (t: Theme, shadow: ReturnType<typeof useCardShadow>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 48, maxWidth: 700, width: '100%', alignSelf: 'center' },
    avatarSection: { alignItems: 'center', marginBottom: 24 },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarPlaceholder: {
      backgroundColor: t.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    avatarInitial: { fontSize: 36, fontWeight: '800', color: t.accent },
    avatarBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: t.bg,
    },
    avatarBadgeText: { fontSize: 13 },
    avatarLink: { color: t.accent, fontSize: 14, fontWeight: '700', marginTop: 12 },
    avatarRemoveLink: { color: t.danger, fontSize: 13, fontWeight: '600', marginTop: 8 },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 18,
      ...shadow,
    },
    label: { fontSize: 12, fontWeight: '700', color: t.inkSoft, textTransform: 'uppercase', letterSpacing: 1 },
    email: { fontSize: 16, fontWeight: '700', color: t.ink, marginTop: 4 },
    blurb: { fontSize: 14, color: t.inkSoft, lineHeight: 20 },
    button: {
      backgroundColor: t.accentSoft,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      marginTop: 14,
      borderWidth: 1,
      borderColor: t.border,
    },
    buttonText: { color: t.accent, fontSize: 14, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
