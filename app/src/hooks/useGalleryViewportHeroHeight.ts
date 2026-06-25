import { useMemo } from 'react';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_BASE_HEIGHT } from '../components/common/AppScreenLayout';
import {
  ALBUM_HERO_H_PAD,
  GALLERY_CHROME,
  GALLERY_COMMENT_ROW_H,
  GALLERY_HERO_CONTENT_MAX,
  GALLERY_HERO_CONTENT_MIN,
  GALLERY_HERO_SLIDE_V_PAD,
  GALLERY_MAX_VISIBLE_COMMENTS,
} from '../constants/albumPhotosLayout';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type UseGalleryViewportHeroHeightParams = {
  hasTravelers?: boolean;
  hasDescription?: boolean;
  hasFooter?: boolean;
  hasMetaCard?: boolean;
  hasPhotos?: boolean;
  emptyHero?: boolean;
  editMode?: boolean;
  viewOnly?: boolean;
  /**
   * While the keyboard is open, shrink the hero so the comment panel keeps a
   * usable viewport above the keyboard (the active compose/edit input stays
   * visible). Layout above the comments scrolls back into place on dismiss.
   */
  keyboardVisible?: boolean;
};

/** Hero slot height while the keyboard is up — leaves room for the comment panel. */
const GALLERY_HERO_KEYBOARD_H = 160;

export function useGalleryViewportHeroHeight({
  hasTravelers = false,
  hasDescription = false,
  hasFooter = false,
  hasMetaCard = false,
  hasPhotos = true,
  emptyHero = false,
  editMode = false,
  viewOnly = false,
  keyboardVisible = false,
}: UseGalleryViewportHeroHeightParams = {}): number {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    // Typing: collapse the hero to free vertical space for comments + input.
    if (keyboardVisible && hasPhotos) {
      return GALLERY_HERO_KEYBOARD_H;
    }
    const tabBarPad = TAB_BAR_BASE_HEIGHT + insets.bottom + 6;
    const subHeader = editMode ? GALLERY_CHROME.subHeaderEdit : GALLERY_CHROME.subHeader;
    const composeGhost = viewOnly ? 0 : GALLERY_CHROME.composeGhost;
    const commentsPanel = hasPhotos
      ? GALLERY_COMMENT_ROW_H * GALLERY_MAX_VISIBLE_COMMENTS
      : 0;
    const heroMin = hasPhotos ? GALLERY_HERO_CONTENT_MIN : (emptyHero ? 300 : 148);

    const fixedChrome =
      insets.top +
      GALLERY_CHROME.appHeader +
      subHeader +
      tabBarPad +
      (hasPhotos ? GALLERY_CHROME.thumbStrip : 0) +
      (hasDescription ? GALLERY_CHROME.description : 0) +
      (hasTravelers ? GALLERY_CHROME.travelers : 0) +
      (hasMetaCard ? GALLERY_CHROME.metaCard : 0) +
      (hasPhotos ? GALLERY_CHROME.stats : 0) +
      composeGhost +
      commentsPanel +
      (hasFooter ? GALLERY_CHROME.footer : 0) +
      GALLERY_CHROME.gaps;

    const availableH = SCREEN_H - fixedChrome;
    const maxWidthContent = SCREEN_W - ALBUM_HERO_H_PAD * 2;

    const heroContent = Math.max(
      heroMin,
      Math.min(maxWidthContent, availableH, GALLERY_HERO_CONTENT_MAX),
    );

    return heroContent + GALLERY_HERO_SLIDE_V_PAD;
  }, [hasTravelers, hasDescription, hasFooter, hasMetaCard, hasPhotos, emptyHero, editMode, viewOnly, keyboardVisible, insets.top, insets.bottom]);
}
