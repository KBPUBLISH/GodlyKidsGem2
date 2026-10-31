# iOS purpose-string rejection

Apple flagged `NSLocationAlwaysUsageDescription`, `NSLocationWhenInUseUsageDescription`, and `NSPhotoLibraryAddUsageDescription` in the submitted iOS binary.

## Findings in this repository

- Godly Kids uses the DeSpia native wrapper. This repository contains the web app, but no iOS project, `Info.plist`, or native permission configuration.
- No device-geolocation requests or background-location commands were found in application source.
- The unused `DespiaService.saveImageToCameraRoll` helper has been removed. No application code called it.
- `DrawingCanvas` implements **Save Drawing** as a PNG download through an HTML link. It does not call the native Photos-saving bridge. The built DeSpia wrapper may handle downloads differently; verify that behavior on an iPhone before deciding whether it needs Photos access.

This code cleanup alone does **not** change the purpose strings or native code in Apple's submitted binary. A Netlify deployment cannot fix that binary.

## Changes needed in the DeSpia iOS build

1. Disable unused device-location features and permission requests in the native wrapper. Remove `NSLocationAlwaysUsageDescription` and `NSLocationWhenInUseUsageDescription`. If present, also remove the unused `NSLocationAlwaysAndWhenInUseUsageDescription` and the `location` entry in `UIBackgroundModes`. Keep unrelated background modes intact. If the dashboard cannot exclude the native location feature, request this change from DeSpia support or update the exported iOS project.
2. Verify **Save Drawing** on an iPhone:
   - If it downloads a file or only opens the system share sheet, remove the unused direct Photos-saving feature and `NSPhotoLibraryAddUsageDescription` from the native wrapper. User-selected file uploads or sharing alone do not establish a need for this permission.
   - If the wrapper directly saves the chosen drawing into Photos, retain the required Photos-add implementation and replace `NSPhotoLibraryAddUsageDescription` with:

     > Godly Kids saves the drawing you create to your Photos library when you tap Save Drawing, so you can keep or share your artwork.

     Use this text only if that is the actual behavior of the submitted build.
3. Generate a new iOS build with a new build number. Confirm the generated app's `Info.plist` contains the intended descriptions/removals, and that no native feature still requests a permission whose description was removed.
4. Test **Save Drawing** and the relevant permission prompt on an iPhone, then upload and select the new build in App Store Connect for review.

Do not invent a location-based feature to justify keeping the default location descriptions. The app's island map is a game world, not a map of the device's physical location.

## Copyable request for DeSpia support

> Apple blocked Godly Kids because its generated iOS binary contains generic purpose strings for NSLocationAlwaysUsageDescription, NSLocationWhenInUseUsageDescription, and NSPhotoLibraryAddUsageDescription. Our web app does not request device geolocation or background location. Please disable the unused native location feature and remove its usage-description keys and location background mode. Our Save Drawing button downloads a PNG; please confirm whether your iOS download handler writes directly to Photos. If it does not, remove the unused direct Photos-saving feature and Photos-add usage description. If it does, use this purpose string: “Godly Kids saves the drawing you create to your Photos library when you tap Save Drawing, so you can keep or share your artwork.” Please generate a new native build with these changes for resubmission.
