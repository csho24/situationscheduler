# IR / AC Integration – Tuya Cloud (Smart IR + Aircon)

This doc records the full journey of getting an IR-controlled Aircon working from our web app, including Cloud setup, API Explorer navigation, endpoints tried, errors, and the final working calls.

## 1) Prereqs: Tuya Cloud Services subscription

- In Tuya IoT Platform → Cloud → Development → Your Project → Add service
- Subscribe/enable services relevant to Infrared Control (IR Control Hub). This was required before any IR endpoints returned success.

## 2) API Explorer: pick the correct product group

- In Tuya API Explorer (top-left dropdown), switch to the IR Control Hub/Infrared AC APIs for your project.
- Use the Singapore endpoint host in our case: `https://openapi-sg.iotbing.com`.

## 3) Devices

- Smart IR (infrared_id): `5810306084f3ebc188ed`
- Aircon remote/device (remote_id): `a3cf493448182afaa9rlgw`
- Category for infrared_ac: `category_id = 5`

## 4) Discovery endpoints used

- Get remote info/keys → returns `key_list` and ranges
- Get remote indexes → confirms `brand_id`, `remote_index`, and `remote_id`

These helped confirm we have a valid learned remote and available standard keys (e.g., `PowerOn`, `PowerOff`, `M`, `T`, `F`).

## 5) Endpoint attempts and outcomes

We tried several families of endpoints. Results varied by remote/brand.

- Standard key-based (worked but “mouse” preset or errors):
  - URL: `/v2.0/infrareds/{infrared_id}/remotes/{remote_id}/command`
    - Body example:
    ```json
    { "category_id": 5, "key": "PowerOn", "key_id": 0 }
    ```
    - Result: Turned ON but often a weak default ("mouse").
  - URL (legacy): `/v1.0/infrareds/{infrared_id}/remotes/{remote_id}/keys/{key}/send`
    - Result: For some keys, `1108 uri path invalid` or `30706 command or value not support`.

- Raw command (worked as strong power, no state control):
  - URL: `/v2.0/infrareds/{infrared_id}/remotes/{remote_id}/raw/command`
  - Body:
    ```json
    { "category_id": 5, "key_id": 0 }
    ```
  - Result: “Blast” ON immediately, but no ability to set mode/temp/fan.

- Combined AC scene command (final, full control):
  - URL: `/v2.0/infrareds/{infrared_id}/air-conditioners/{remote_id}/scenes/command`
  - Body (example that works):
    ```json
    { "power": 1, "mode": 0, "temp": 27, "wind": 2 }
    ```
  - Result: Sets ON and applies exact state: cool (0), 27°C, fan 2.

### Timeline of what happened (why earlier failed)

1) Subscribed to Cloud Services; initially hit “uri path invalid (1108)” on wrong endpoints.
2) Standard key commands worked but defaulted to a weak “mouse” preset for ON.
3) Raw command proved ON “blast” `{category_id:5,key_id:0}` but couldn’t set mode/temp/fan.
4) In API Explorer, under IR Control Hub, found the tab “Control Air Conditioner with Multiple Keys” (combined-state scenes).
5) Using that endpoint with `{power:1,mode:0,temp:27,wind:2}` finally gave correct ON with desired state.

## 6) Errors encountered (and meanings)

- `1108 uri path invalid`: wrong endpoint path for the selected operation.
- `30706 command or value not support`: the remote/brand does not support that key/value or that endpoint’s payload shape.

## 7) Final implementation (web app)

- ON (combined-state):
  - POST `/v2.0/infrareds/5810306084f3ebc188ed/air-conditioners/a3cf493448182afaa9rlgw/scenes/command`
  - Body: `{ "power": 1, "mode": 0, "temp": 27, "wind": 2 }`
- OFF (standard):
  - Use standard PowerOff under remotes command path (works consistently)
  - Body: `{ "category_id": 5, "key": "PowerOff", "key_id": 0 }`

Notes:
- If you only need a strong ON without state, the RAW endpoint with `{ "category_id": 5, "key_id": 0 }` works (“blast”).
- For precise mode/temp/fan, use the AC scenes endpoint (above).

## 8) Why earlier attempts failed

- We were calling generic `/remotes/.../command` or legacy `/v1.0/.../keys/.../send` which do not let you set full AC state and can map to manufacturer defaults ("mouse" ON).
- The missing piece was the AC-specific path segment: `/air-conditioners/.../scenes/command`, which accepts `power/mode/temp/wind` in one go.

## 9) Quick glossary

- `infrared_id`: Smart IR blaster device ID.
- `remote_id`: The specific learned AC remote bound to the IR hub.
- `category_id`: IR category, `5` for infrared_ac.
- `key`: Standard key name (PowerOn, PowerOff, M, T, F) for standard command endpoint.
- `key_id`: Raw IR code index; used only in RAW endpoint.
- `mode` (scenes): 0=cool, 1=heat, 2=auto, 3=fan-only, 4=dry.
- `wind` (scenes): 0=auto, 1=low, 2=middle, 3=high.

## 10) Testing tips in API Explorer

1) Pick IR Control Hub in the top-left product dropdown.
2) Use SG host if you’re in SG: `openapi-sg.iotbing.com`.
3) Tabs we used and what they do:
   - “Send Standard Command” (remotes): simple keys (PowerOn/Off); may apply vendor default presets
   - “Send Raw Command”: fires learned IR code by `key_id`; good for “blast” only
   - “Control Air Conditioner with Multiple Keys” (scenes): combined power/mode/temp/wind
4) If presets are wrong, use scenes:
   - `/v2.0/infrareds/{ir_id}/air-conditioners/{remote_id}/scenes/command`
   - Start with `{ "power": 1, "mode": 0, "temp": 27, "wind": 2 }`.
5) For pure “blast”, test RAW with `{ "category_id": 5, "key_id": 0 }`.

## 11) Current app behavior

- ON → scenes command (cool/27/fan3) - Updated Sep 27, 2025: Changed from fan2 to fan3 (high speed)
- OFF → PowerOff (standard remotes path)
- Aircon status polling returns empty `status` for `infrared_ac`; UI shows neutral on refresh and reflects user actions within the session.

## 12) Why the toggle does not persist on refresh (and what we did)

- Problem: Tuya device query `/v1.0/devices/{deviceId}` for `infrared_ac` returns an empty `status` array (IR devices are stateless). There is no reliable “current power/mode” to read back from cloud.
- Result: After a full page reload, we cannot know ON/OFF, mode, or fan from the API, so a naïve implementation would wrongly default to OFF.
- Our approach:
  - Treat empty status as unknown and render the Aircon toggle in a neutral/gray state on refresh.
  - Within the session, the toggle reflects what you did (ON/OFF) without using localStorage (per requirement).
- Why not persist locally or in DB:
  - LocalStorage is explicitly avoided.
  - Persisting guessed state in DB would drift from reality (since physical remote can change AC at any time).
- Alternatives (trade-offs):
  - Poll the combined-scene endpoint to infer state: not supported; scenes are write-only.
  - Maintain a server-side last-command log and show that as a hint (not real state): acceptable but still a guess.
  - Use a hardware sensor (e.g., smart energy plug or temperature sensor) to infer ON state: adds hardware and complexity.


## 13) Optional: DIY/Learned Remote for “Power-only”

If you want to reproduce your physical remote’s Power exactly (to avoid presets) you can create a DIY/Learned remote and use its learned Power key:

- In Tuya/Smart Life app → IR blaster → add new remote → choose DIY/Study → Air Conditioner.
- Learn just the Power button from your physical remote, save as “Power” (and optionally learn a separate “Power Off” if your remote has distinct keys).
- In API Explorer, list remotes for your IR blaster to get the new `remote_id` (it will differ from the brand-library one).
- List keys for that DIY `remote_id`, note the learned Power `key_id`.
- Send via RAW/Key-send endpoint using that DIY `remote_id` + `key_id` to trigger “Power-only”.

Notes:
- If your physical Power is a toggle, the learned key will also toggle (not guaranteed on-only).
- Keep using the scenes endpoint when you need explicit mode/temp/fan; DIY Power is best when you only want to reproduce the original Power behavior.

