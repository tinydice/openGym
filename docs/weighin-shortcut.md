# Weigh-ins from a smart scale (iOS Shortcut)

A smart scale's own app (VeSync, for example) writes each weigh-in to Apple Health. An iOS
Shortcut reads the latest one from Health and posts it to `POST /api/weighin` on your server,
so it appears in openGym without typing. Set up once; it runs by itself whenever the scale's
app closes.

Needs: an iPhone, the scale's app, and a phone that can reach your server when the Shortcut
runs (if the server is only on a VPN such as Tailscale, the VPN has to be on).

Not tested on a phone by the author: the Shortcuts app renames things between iOS versions, so
the wording below may differ slightly on yours.

## 1. Let the scale's app write to Apple Health

1. In the scale's app, switch on **Apple Health**. In VeSync: tap **Me** (bottom right) >
   **Third-Party Services** > **Apple Health** > **Connect**. (If your version has no such
   menu, open the scale from the device list, tap the gear, and look for Apple Health there.)
2. When iOS asks, allow it to write **Weight** and **Body Fat Percentage** (add Lean Body
   Mass if you want it; openGym does not use that yet).
3. Check it on the phone: **Settings > Privacy & Security > Health > (the scale's app)**
   and turn on those categories.
4. Step on the scale once, then open **Health > Browse > Body Measurements > Weight > Show
   All Data**. The new reading should be there with the scale's app as the source. If it is
   not, nothing below can work.

## 2. Make the token in openGym

1. **Settings > Account > Weigh-in token > Make a token.**
2. Tap **Copy token** and paste it somewhere safe for the next ten minutes (a note). It is
   shown once. Also copy the address under "Post to".

The token can add weigh-ins and nothing else. **Revoke** in the same place ends it.

## 3. Build the Shortcut

In the **Shortcuts** app, tap **+** and name it "Send weight". Add these actions in order.

1. **Find Health Samples**. Type: **Weight**. Sort by: **Start Date**, order **Latest First**,
   Limit **1**.
2. **Get Details of Health Samples** (or tap the result and pick the property): get
   **Value**, then again **Unit**, then again **Start Date**. Name them (Set Variable)
   `W`, `U`, `D`.
3. **Round Number**: `W`, to **Hundredths**. Set Variable `W`.
4. **Format Date**: `D`, Date Format **Custom**, `yyyy-MM-dd`. Set Variable `Day`.
5. **If** `U` **contains** `kg`: Text `kg`. **Otherwise**: Text `lb`. **End If**. Set Variable
   `Key`. (openGym accepts either unit and converts to your profile's unit, so nothing else
   is converted by hand.)
6. **Find Health Samples**. Type: **Body Fat Percentage**, Latest First, Limit 1. Then
   **If** it **has any value**: get its **Value**, Set Variable `BF`. **Otherwise**: Text
   `null`, Set Variable `BF`. **End If**.
   Look at the value once with **Show Result**. openGym wants 18.2 for 18.2%. If the
   Shortcut shows 0.182, add a **Calculate** (`Value` x `100`) before saving it to `BF`.
   A value that is too small is refused with an error, so a mistake is not silent.
7. **Text**, with the variables dropped in where the names are:

   ```
   {"date":"Day","Key":W,"extras":{"bf":BF}}
   ```

   (Type the quotes and braces yourself; for each of `Day`, `Key`, `W`, `BF`, tap the word
   and choose the variable. `Key` goes inside quotes, `W` and `BF` do not.) Set Variable
   `Body`. This assumes your phone writes decimals with a point; a comma-decimal region
   needs the numbers formatted with a point first.
8. **Get Contents of URL**:
   - URL: the address copied in step 2 (`https://your-server/api/weighin`)
   - Method: **POST**
   - Headers: `Authorization` = `Bearer ` followed by the token (one space, no quotes), and
     `Content-Type` = `application/json`
   - Request Body: **File**, choose `Body`
9. For the first runs add **Show Result** at the end. A good answer starts with
   `{"ok":true,"applied":true`. Remove it afterwards.

Run it by hand once with the scale's reading already in Health, then open openGym: Home >
Body weight shows the dot, and the day appears in All weigh-ins with its body fat.

## 4. Run it by itself

In the **Automation** tab, tap **+ > App**, choose the scale's app and **Is Closed**, then
choose the Shortcut. Set **Run Immediately** and switch **Notify When Run** off.

Health can take a minute to receive the scale's data after the app closes, so add a second
automation as a safety net: **Time of Day**, daily (for example 08:00), the same Shortcut,
Run Immediately. Running it twice is harmless: a day keeps one scale entry, and a second post
for the same day replaces it.

## What the server does with it

- One entry per day. A later post for the same day from the same source replaces the first.
  A day you typed in the app yourself is left alone (the answer says `"applied":false`).
- The weight is converted to your profile's unit. `extras` accepts `bf` (body fat %), `mm`
  (muscle mass, in the unit of the weight), `bw` (body water %) and `vf` (visceral fat
  rating). They show under the day in All weigh-ins.
- An open app picks the new entry up within about 30 seconds.

## When it does not work

| Answer | Meaning |
|---|---|
| 401 | The token is wrong, was replaced by a newer one, or was revoked. Make a new one and update the header. |
| 400 `date must be...` | Step 4's date format is not exactly `yyyy-MM-dd`. |
| 400 `send exactly one of kg or lb` | Step 5 produced neither key, or `U` was empty (no weight sample found). |
| 400 `bf is out of range` | Body fat is 0.18 rather than 18 (step 6). |
| 409 | Your profile has no data on the server yet: open openGym once on a device and let it sync. |
| Timeout, no answer | The phone cannot reach the server (VPN off, wrong address). |

The full request format is in `api/openapi.yaml` under `POST /api/weighin`.
