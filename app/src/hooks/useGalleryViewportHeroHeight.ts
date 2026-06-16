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
  editMode?: boolean;
  viewOnly?: boolean;
};

export function useGalleryViewportHeroHeight({
  hasTravelers = false,
  hasDescription = false,
  hasFooter = false,
  hasMetaCard = false,
  editMode = false,
  viewOnly = false,
}: UseGalleryViewportHeroHeightParams = {}): number {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const tabBarPad = TAB_BAR_BASE_HEIGHT + insets.bottom + 6;
    const subHeader = editMode ? GALLERY_CHROME.subHeaderEdit : GALLERY_CHROME.subHeader;
    const composeGhost = viewOnly ? 0 : GALLERY_CHROME.composeGhost;
    const commentsPanel = GALLERY_COMMENT_ROW_H * GALLERY_MAX_VISIBLE_COMMENTS;

    const fixedChrome =
      insets.top +
      GALLERY_CHROME.appHeader +
      subHeader +
      tabBarPad +
      GALLERY_CHROME.thumbStrip +
      (hasDescription ? GALLERY_CHROME.description : 0) +
      (hasTravelers ? GALLERY_CHROME.travelers : 0) +
      (hasMetaCard ? GALLERY_CHROME.metaCard : 0) +
      GALLERY_CHROME.stats +
      composeGhost +
      commentsPanel +
      (hasFooter ? GALLERY_CHROME.footer : 0) +
      GALLERY_CHROME.gaps;

    const availableH = SCREEN_H - fixedChrome;
    const maxWidthContent = SCREEN_W - ALBUM_HERO_H_PAD * 2;

    const heroContent = Math.max(
      GALLERY_HERO_CONTENT_MIN,
      Math.min(maxWidthContent, availableH, GALLERY_HERO_CONTENT_MAX),
    );

    return heroContent + GALLERY_HERO_SLIDE_V_PAD;
  }, [hasTravelers, hasDescription, hasFooter, hasMetaCard, editMode, viewOnly, insets.top, insets.bottom]);
}
