# Placeholders by Screen

All `placeholder` prop values used across every screen and shared component in the app.

---

## Auth Screens

### Login Screen
| Field | Placeholder Text |
|---|---|
| Email | `Email address` |
| Password | `Password` |

---

### Sign Up Screen
| Field | Placeholder Text |
|---|---|
| Email | `Email address *` |
| Phone number | `Phone number` |
| Password | `Password *` |
| Confirm password | `Confirm Password *` |

---

### Forgot Password Screen
| Field | Placeholder Text |
|---|---|
| Email | `Email` |

---

### Reset Password Screen
| Field | Placeholder Text |
|---|---|
| New password | `Enter new password` |
| Confirm new password | `Re-enter new password` |

---

### Create Profile Screen
| Field | Placeholder Text |
|---|---|
| Full name | `e.g. Alex Johnson` |
| Date of birth | `DD/MM/YYYY` |

---

### OTP Verification Screen
No placeholder text — digit inputs have no placeholder.

---

## Home

### Home Screen
| Field | Placeholder Text | Condition |
|---|---|---|
| AI search bar (collapsed) | `Ask Swee...` | When search bar is in compact/tiny state |
| AI search bar (expanded) | `What do you have in mind?` | When search bar is expanded |

---

## Trips

### Trips Screen (Create Trip sheet)
| Field | Placeholder Text |
|---|---|
| Trip name | `e.g., Tokyo Getaway` |
| Destination | `Search and add destination...` |
| Search friends | `Search friends...` |
| Invite by email | `Enter email address` |
| Invite by phone | `Enter phone number` |
| Invite by WhatsApp | `Enter WhatsApp number` |

---

### Trip Detail Screen
**Edit Trip**
| Field | Placeholder Text |
|---|---|
| Trip name | `e.g., Tokyo Getaway` |
| Destination | `Search and add destination...` |

**Add Activity**
| Field | Placeholder Text |
|---|---|
| Activity title | `e.g., Visit Eiffel Tower` |
| Date | `DD/MM/YY` |
| Location | `e.g., Champ de Mars, Paris` |
| Additional details | `Add any additional details...` |

**Add Expense**
| Field | Placeholder Text |
|---|---|
| Expense name | `e.g., Dinner at restaurant` |
| Description | `Description` |
| Amount | `Amount` |
| Split amount (per person) | `0` |
| Search member | `Search by name or email...` |

**Add Poll**
| Field | Placeholder Text |
|---|---|
| Poll question | `What do you want to ask?` |
| Poll option (dynamic) | `Option 1`, `Option 2`, … |

**Add Note**
| Field | Placeholder Text |
|---|---|
| Note title | `Note title...` |
| Note body | `Write your note here...` |

---

## Events

### Events Screen (Create Event sheet)
| Field | Placeholder Text |
|---|---|
| Event name | `e.g., Birthday Celebration` |
| Venue | `Search and add venue...` |
| Search friends | `Search friends...` |
| Invite by email | `Enter email address` |
| Invite by phone | `Enter phone number` |
| Invite by WhatsApp | `Enter WhatsApp number` |

---

### Event Detail Screen
**Edit Event**
| Field | Placeholder Text |
|---|---|
| Event name | `e.g., Spring Music Festival` |
| Venue | `Search and add venue...` |

**Add Expense**
| Field | Placeholder Text |
|---|---|
| Expense description | `e.g., Event tickets` |
| Amount | `0.00` |
| Split amount (per person) | `0` |
| Search member | `Search by name...` |

**Add Poll**
| Field | Placeholder Text |
|---|---|
| Poll question | `What do you want to ask?` |
| Poll option (dynamic) | `Option 1`, `Option 2`, … |

**Add Note**
| Field | Placeholder Text |
|---|---|
| Note title | `Note title...` |
| Note body | `Write your note here...` |

---

## Gallery

### Gallery Tab (Create Album sheet)
| Field | Placeholder Text | Condition |
|---|---|---|
| Album title | `Album title, e.g. Bali 2025` | When creating a trip album |
| Album title | `Album title, e.g. Summer BBQ` | When creating an event album |

---

### Gallery Album (inside album)
| Field | Placeholder Text |
|---|---|
| Album name (edit mode) | `Name` |
| Album description/caption | `Add a short caption for this album…` |
| Comment input | `Write a comment…` |

---

## Profile

### Edit Profile Screen
| Field | Placeholder Text |
|---|---|
| Full name | `e.g. Alex Johnson` |
| Username | `e.g. alex_gg` |
| Bio | `Adventurer, foodie, or slow traveler? Tell us your story...` |

---

### Change Password Screen
| Field | Placeholder Text |
|---|---|
| Current password | `Enter current password` |
| New password | `Enter new password` |
| Confirm new password | `Re-enter new password` |

---

## Chat (Swee AI)

### Chat Detail Screen
| Field | Placeholder Text |
|---|---|
| Main chat input | `Ask Swee anything...` |
| Context input | `Add more context...` |

---

## Friends

### Friends Screen
| Field | Placeholder Text |
|---|---|
| Friend search | `Search by name or handle...` |

---

## Shared Components

These components appear inside multiple screens.

### Location Autocomplete
| Field | Placeholder Text |
|---|---|
| Location search | `Search location...` (default, overridden per screen) |

### Location Multi-Picker
| Field | Placeholder Text |
|---|---|
| Location search | `Search and add location...` (default, overridden per screen) |

### Currency Picker Dropdown
| Field | Placeholder Text |
|---|---|
| Currency search | `Search currency...` |

### Date Picker
| Field | Placeholder Text |
|---|---|
| Date input | `DD/MM/YY` |

### Invite Via Channels (shared invite modal)
| Field | Placeholder Text |
|---|---|
| Email | `Enter email address` |
| Phone / WhatsApp | `Phone number` |
| Contact search | `Search name or number...` |

---

*Placeholder text color used throughout: `#94a3b8` (slate-400)*
