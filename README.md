# Spatial Projectiles Lab (WebXR VR / AR)
### The Thinking Experiment &bull; PhysicsKit
**Author:** Vladimir Lopez  
**Live Site:** [https://thinking-experiment-sims.github.io/projectile-motion-webxr/](https://thinking-experiment-sims.github.io/projectile-motion-webxr/)  
**Simulation Catalog:** [https://thinking-experiment-sims.github.io/interactive-physics/](https://thinking-experiment-sims.github.io/interactive-physics/)

---

## 🎯 Overview

The **Spatial Projectiles Lab** is an interactive, high-precision 3D and WebXR physics simulation engineered for both desktop/tablet web browsers and **Meta Quest / Oculus headsets (Quest 2, 3, 3S, and Pro)**.

Students explore 2D projectile kinematics in true 3D spatial space or in **Mixed Reality Passthrough** (projected directly onto their physical classroom desk or floor).

---

## 🔬 Core Pedagogical Concepts

### 1. SOH CAH TOA Initial Velocity Decomposition
The launch velocity \(\vec{v}_0\) acts as the hypotenuse at launch angle \(\theta\):
- **Horizontal Velocity (CAH):**
  \[
  \cos(\theta) = \frac{v_{0x}}{v_0} \implies v_{0x} = v_0 \cos(\theta)
  \]
  Because horizontal acceleration is zero (\(a_x = 0\)), **\(v_{0x}\) remains strictly constant throughout the entire flight.**
- **Vertical Velocity (SOH):**
  \[
  \sin(\theta) = \frac{v_{0y}}{v_0} \implies v_{0y} = v_0 \sin(\theta)
  \]
  Gravity acts purely on the vertical component (\(a_y = -g\)):
  \[
  v_y(t) = v_{0y} - gt
  \]
- **Angle Relationship (TOA):**
  \[
  \tan(\theta) = \frac{v_{0y}}{v_{0x}} \implies \theta = \arctan\left(\frac{v_{0y}}{v_{0x}}\right)
  \]

### 2. Velocity at the Top (Apex) & Common Misconceptions
- At the maximum height (\(H_{\max}\)), the vertical velocity ceases momentarily:
  \[
  v_y = 0 \text{ m/s}
  \]
- **Critical AP Physics Misconception addressed:** *Is the velocity zero at the peak?* **No!**
  The projectile still moves horizontally:
  \[
  v_{\text{peak}} = v_x = v_0 \cos(\theta) \ne 0
  \]

### 3. Flight Times: Times Up and Down
- **Time to reach apex (\(t_{\text{up}}\)):**
  \[
  t_{\text{up}} = \frac{v_{0y}}{g}
  \]
- **Maximum Height (\(H_{\max}\)):**
  \[
  H_{\max} = y_0 + \frac{v_{0y}^2}{2g}
  \]
- **Time to fall from apex to ground (\(t_{\text{down}}\)):**
  \[
  t_{\text{down}} = \sqrt{\frac{2 H_{\max}}{g}}
  \]
- **Total Flight Time (\(t_{\text{total}}\)):**
  \[
  t_{\text{total}} = t_{\text{up}} + t_{\text{down}}
  \]
  *(When launch height \(y_0 = 0\), \(t_{\text{up}} = t_{\text{down}}\). When elevated \(y_0 > 0\), \(t_{\text{down}} > t_{\text{up}}\).)*

### 4. Total Horizontal Range
\[
R = v_{0x} \cdot t_{\text{total}}
\]

### 5. Obstacle Clearance Studio
Given a barrier at horizontal distance \(x_{\text{wall}}\) with height \(h_{\text{wall}}\):
1. Compute time to reach barrier:
   \[
   t_{\text{wall}} = \frac{x_{\text{wall}}}{v_{0x}}
   \]
2. Compute vertical height at the wall:
   \[
   y_{\text{wall}} = y_0 + v_{0y} t_{\text{wall}} - \frac{1}{2} g t_{\text{wall}}^2
   \]
3. Compute clearance margin:
   \[
   \Delta y = y_{\text{wall}} - h_{\text{wall}}
   \]
   - If \(\Delta y > 0\): Projectile clears the barrier.
   - If \(\Delta y \le 0\): Collision occurs.

---

## 🥽 Meta Quest / Oculus VR & AR Quick Start

### How to Run in the Headset:
1. Put on your **Meta Quest 2, 3, 3S, or Pro**.
2. Open the built-in **Meta Quest Browser**.
3. Visit the live URL:  
   `https://thinking-experiment-sims.github.io/projectile-motion-webxr/`
4. Click:
   - **"Enter AR (Passthrough)"**: Projects the simulation as an interactive tabletop or room-scale diorama directly in your real room!
   - **"Enter VR"**: Immerses you in a full, clean virtual physics laboratory.
5. **Controller Controls:**
   - **Laser Ray:** Aim at buttons on the floating 3D control panel.
   - **Trigger / 'A' Button:** Squeeze to fire the projectile.
   - **Reset / 'B' Button:** Reset projectile to start.
   - **Tactile Haptic Feedback:** Vibrates subtly upon launch and button interactions.

---

## 🎨 Design System Compliance
- **Brand Palette:** Primary Teal (`#0f7e9b`), Accent Amber (`#d67b19`), Background White (`#ffffff`), Text (`#123140`).
- **Strict Light Mode:** `color-scheme: light` enforced across all viewports and panels.
- **Formulas & Math:** Rendered with KaTeX and clean Unicode typography.
