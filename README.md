# Presence card

A person/device tracker card for Home Assistant. Displays home/away status with avatar images or initials, in either a large single-person view or a compact list for multiple people.

## Installation

### HACS (recommended)

1. In Home Assistant, go to **HACS → Frontend → ⋮ → Custom repositories**
2. Add this repository URL and set the category to **Lovelace**
3. Click **Download** on the presence-card entry
4. Restart Home Assistant

### Manual

1. Copy `presence-card.js` to your Home Assistant `config/www/` folder.
2. Add the resource in your Lovelace dashboard:
   - **Settings → Dashboards → Resources → Add Resource**
   - URL: `/local/presence-card.js`
   - Type: `JavaScript module`

## Configuration

Either `entity` or `entities` is required.

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | — | A single `person.*` or `device_tracker.*` entity |
| `entities` | list | — | Multiple person/device entities (see below) |
| `name` | string | entity name | Display name override (single entity only) |
| `title` | string | — | Card title (shown automatically for multiple entities) |
| `background` | string | `var(--card-background-color)` | Card background color |
| `interactions` | list | — | Tap/hold/double-tap actions (see below) |

### `entities` items

Each item in the `entities` list can be a plain entity ID string or an object:

```yaml
entities:
  - person.alice                               # string shorthand
  - entity: person.bob
    name: Dad                                  # name override
```

## Interactions

Attach actions to `tap`, `hold` (500 ms), or `double_tap` events by adding an `interactions` list.

```yaml
interactions:
  - trigger: tap        # tap | hold | double_tap  (default: tap)
    action: more-info   # see action reference below
```

| Action | Extra fields | Description |
|---|---|---|
| `more-info` | `entity` (optional) | Open the HA more-info dialog. Defaults to the first entity. |
| `toggle` | `entity` (optional) | Toggle the entity. |
| `call-service` | `service`, `service_data` | Call any HA service. `service` is `domain.service` format. |
| `navigate` | `path` | Navigate to a Lovelace path. |
| `url` | `url`, `target` | Open a URL. `target` defaults to `_blank`. |
| `none` | — | Explicit no-op. |

## Examples

**Single person:**
```yaml
type: custom:daires-hass-cards-presence-card
entity: person.alice
```

**Whole household:**
```yaml
type: custom:daires-hass-cards-presence-card
title: Family
entities:
  - person.alice
  - person.bob
  - person.carol
```

**With name override and tap to more-info:**
```yaml
type: custom:daires-hass-cards-presence-card
entity: person.alice
name: Mum
interactions:
  - action: more-info
```

## Demo

Open `demo.html` in a browser to preview the card without Home Assistant.
