const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList')
  .default;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * On Windows, Metro's file watcher can crash with UNKNOWN lstat errors when it
 * walks Android CMake output under android/app/.cxx (e.g. _CMakeLTOTest-CXX
 * junctions). Those paths are not part of the JS bundle; exclude them.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

module.exports = mergeConfig(config, {
  resolver: {
    blockList: exclusionList([
      'android/app/.cxx/.*',
      'android/.gradle/.*',
      'android/build/.*',
      'android/app/build/.*',
    ]),
  },
});
