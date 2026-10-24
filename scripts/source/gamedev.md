Yes. This is a very good next domain to learn because **game development has an enormous vocabulary**, and once you know it, the quality of what you can ask Codex to build changes dramatically.

One important correction to the mental model first:

> **Three.js is not really “a game engine” in the same sense as Unity or Unreal.** It is primarily a 3D rendering library/runtime. Around it, people build game-engine-like systems themselves, or use ecosystems such as React Three Fiber, Drei and Rapier. PlayCanvas and Babylon.js provide more of the engine-style pieces out of the box. Three.js itself gives you the scene graph, cameras, meshes, materials, loaders, animation, rendering and related primitives. citeturn374925search11turn176771search0turn748633search1

And yes, the thing you saw recently about **GTA V running in a browser was a real reported event**: an unofficial browser port reportedly used WebAssembly and was taken down very quickly. That is not equivalent to “someone recreated GTA V with three.js”; it demonstrates that substantial native game code can be adapted toward browser execution, which is a very different problem from building a Three.js recreation. citeturn751769news85

image_group{"layout":"carousel","aspect_ratio":"16:9","image_refs":["turn678868image2","turn678868image1","turn678868image0"]}

# The first mental model

When you say:

> “I want to make a GTA-like web game.”

there are actually many systems hidden inside that sentence:

```text
                         GAME
                          │
        ┌─────────────────┼──────────────────┐
        ↓                 ↓                  ↓
      WORLD            GAMEPLAY            PRESENTATION
        │                 │                  │
   terrain            movement            rendering
   buildings          weapons             lighting
   vehicles            health             animation
   NPCs                quests             particles
   props               inventory          camera
        │                 │                  │
        └─────────────────┼──────────────────┘
                          ↓
                     ENGINE CORE
                          │
       ┌──────────────────┼──────────────────┐
       ↓                  ↓                  ↓
    physics             audio             input
       ↓                  ↓                  ↓
    collision          spatial audio      keyboard
       ↓                                     mouse
     navmesh                                  gamepad
                          │
                          ↓
                    PERFORMANCE
                          │
         ┌────────────────┼─────────────────┐
         ↓                ↓                 ↓
       culling          LOD              instancing
         ↓                ↓                 ↓
     streaming         batching         GPU work
                          │
                          ↓
                    MULTIPLAYER
                          │
      server authority / prediction / interpolation
```

That is the vocabulary you want.

---

# 1. The foundational game-dev vocabulary

Start here.

### World

`Game world`  
`World coordinates`  
`Local coordinates`  
`World space`  
`Local space`  
`Screen space`  
`View space`  
`Transform`  
`Position`  
`Rotation`  
`Scale`  
`Quaternion`  
`Euler angles`  
`Vector`  
`Matrix`  
`Transform hierarchy`

The most important mental model:

```text
Parent
  │
  └── Child
       │
       └── Child
```

A child can have a local position relative to its parent, while its final world transform comes from the hierarchy.

This is absolutely fundamental to things like:

```text
car
 ├── body
 ├── wheel_FL
 ├── wheel_FR
 ├── wheel_RL
 └── wheel_RR
```

---

# 2. Scene graph

This is one of the first concepts you should understand.

Three.js is built around `Object3D`/scene hierarchies, with meshes containing geometry and material and being placed into a scene for rendering. citeturn374925search11turn176771search6

```text
Scene
 │
 ├── World
 │    ├── Building
 │    ├── Car
 │    │    ├── Body
 │    │    ├── Wheel
 │    │    └── Wheel
 │    └── NPC
 │
 ├── Lights
 │
 └── Camera
```

Vocabulary:

`Scene`  
`Scene graph`  
`Object3D`  
`Group`  
`Parent`  
`Child`  
`Hierarchy`  
`Transform hierarchy`

When prompting Codex:

> “Keep the vehicle as a hierarchical scene graph with wheels parented to the chassis.”

That is infinitely more precise than:

> “Make the car structure properly.”

---

# 3. Mesh / geometry / material

This is the core Three.js vocabulary.

```text
Mesh
 ├── Geometry
 └── Material
       └── Texture
```

Three.js describes a mesh as geometry + material, with transforms determining its placement. citeturn374925search11

### Geometry

The actual shape.

```text
BoxGeometry
SphereGeometry
BufferGeometry
Indexed geometry
Vertex
Index
Normal
UV
Tangent
```

### Material

How the surface behaves visually.

```text
Material
 ├── color
 ├── roughness
 ├── metalness
 ├── opacity
 └── textures
```

### Texture

Image/data applied to the surface.

```text
Albedo / Base Color
Normal Map
Roughness Map
Metalness Map
AO Map
Emissive Map
Height Map
Displacement Map
```

This vocabulary alone will massively improve your prompts.

---

# 4. PBR

One of the most important graphics terms:

**Physically Based Rendering**

Vocabulary:

`PBR`  
`Metalness`  
`Roughness`  
`Specular`  
`Base color`  
`Normal map`  
`Ambient occlusion`  
`Emissive`  
`Environment map`  
`HDR environment`

Instead of:

> “Make the metal realistic.”

you can say:

> “Use PBR materials with high metalness and low roughness, plus an HDR environment for reflections.”

That's a meaningful technical request.

---

# 5. Lighting

Games are not simply:

```text
object + color
```

Lighting becomes its own system.

Learn:

`Directional light`  
`Point light`  
`Spotlight`  
`Area light`  
`Ambient light`  
`Environment lighting`  
`HDRI`  
`Shadow map`  
`Soft shadow`  
`Contact shadow`  
`Light probe`  
`Reflection probe`  
`Global illumination`  
`Indirect lighting`  
`Ambient occlusion`

Then:

```text
World
  │
  ├── sun
  ├── street lights
  ├── emissive signs
  └── environment
```

---

# 6. Shaders

This is where 3D starts becoming much deeper.

`Vertex shader`  
`Fragment shader`  
`Shader program`  
`Uniform`  
`Attribute`  
`Varying`  
`Vertex displacement`  
`Fragment shading`  
`UV coordinates`  
`Noise shader`  
`Procedural shader`  
`Fresnel`  
`Normal mapping`  
`Parallax mapping`  
`SDF`  
`Signed Distance Field`

Modern Three.js has moved strongly toward its WebGPU renderer and **TSL (Three.js Shading Language)** for platform-independent node-based shader development. Its newer WebGPU post-processing also supports MRT and automatic effect-pass combination. citeturn374925search4turn374925search3

So you'll increasingly encounter:

```text
Three.js
   ↓
WebGPU
   ↓
TSL
   ↓
GPU shader
```

---

# 7. The game loop

This is absolutely fundamental.

```text
                    GAME LOOP

                  ┌───────────┐
                  │   INPUT   │
                  └─────┬─────┘
                        ↓
                  ┌───────────┐
                  │   UPDATE  │
                  └─────┬─────┘
                        ↓
                  ┌───────────┐
                  │  PHYSICS  │
                  └─────┬─────┘
                        ↓
                  ┌───────────┐
                  │    AI     │
                  └─────┬─────┘
                        ↓
                  ┌───────────┐
                  │  RENDER   │
                  └─────┬─────┘
                        │
                        └──────► repeat
```

Vocabulary:

`Game loop`  
`Frame`  
`FPS`  
`Delta time`  
`Fixed timestep`  
`Variable timestep`  
`Update loop`  
`Render loop`  
`Simulation tick`  
`Physics tick`

This leads to an incredibly important concept:

### Fixed timestep

Physics often wants:

```text
10 ms
10 ms
10 ms
10 ms
```

even if rendering is:

```text
16 ms
16 ms
25 ms
12 ms
```

Otherwise physics can behave differently depending on frame rate.

---

# 8. Determinism

Very important for multiplayer and simulation.

`Determinism`  
`Deterministic simulation`  
`Floating-point determinism`  
`Fixed timestep`  
`Replay`  
`Reproducible simulation`

Think:

```text
Input A
   ↓
Simulation
   ↓
State X
```

If you run the same input again, you ideally want:

```text
Input A
   ↓
Simulation
   ↓
State X
```

This becomes much harder when network timing and floating-point behavior are involved.

---

# 9. Physics

The vocabulary here is huge.

`Rigid body`  
`Collider`  
`Collision shape`  
`Static body`  
`Dynamic body`  
`Kinematic body`  
`Mass`  
`Gravity`  
`Velocity`  
`Angular velocity`  
`Force`  
`Impulse`  
`Torque`  
`Friction`  
`Restitution`  
`Constraint`  
`Joint`  
`Raycast`  
`Shape cast`  
`Collision manifold`  
`Broad phase`  
`Narrow phase`  
`Continuous collision detection`  
`CCD`

For web + React Three Fiber, **Rapier** is particularly relevant; the R3F ecosystem has an official-ish integration wrapper, and Rapier's JavaScript package uses WebAssembly. citeturn176771search8turn748633search5

---

# 10. Collision detection

This deserves special attention.

Naive:

```text
every object
    ↕
every other object
```

gets very expensive.

So physics uses:

```text
             COLLISION
                 │
          ┌──────┴──────┐
          ↓             ↓
      Broad phase    Narrow phase
          │             │
     possible pairs   exact test
```

Vocabulary:

`Broad phase`  
`Narrow phase`  
`AABB`  
`Bounding sphere`  
`Bounding box`  
`BVH`  
`Spatial partitioning`  
`Sweep and prune`  
`Spatial hash`

---

# 11. Animation

Three.js has a real animation system with animation clips, mixers, blending, crossfading, time scaling, skeletal animation and morph targets. citeturn374925search9turn176771search7

Learn:

`Animation clip`  
`Animation mixer`  
`Animation action`  
`Keyframe`  
`Skeletal animation`  
`Rig`  
`Bone`  
`Skinning`  
`Morph target`  
`Blend`  
`Crossfade`  
`Animation state`  
`Animation state machine`  
`Locomotion`

Example:

```text
Character
   │
   └── Animation State Machine

       Idle
        │
     movement
        ↓
      Walk
        │
     speed ↑
        ↓
      Run
```

Now you can tell Codex:

> “Use a locomotion state machine and crossfade between idle, walk and run based on velocity.”

---

# 12. Character controller

This is a major concept.

A player's character is usually not:

```text
position.x += 1
```

Real movement involves:

```text
Input
  ↓
Desired direction
  ↓
Acceleration
  ↓
Velocity
  ↓
Collision
  ↓
Ground detection
  ↓
Slope handling
  ↓
Character position
  ↓
Animation
```

Vocabulary:

`Character controller`  
`Acceleration`  
`Deceleration`  
`Air control`  
`Grounded`  
`Step height`  
`Slope limit`  
`Jump impulse`  
`Gravity`  
`Capsule collider`  
`Ground snapping`

---

# 13. Camera systems

Games use many camera models.

`Perspective camera`  
`Orthographic camera`  
`Third-person camera`  
`First-person camera`  
`Orbit camera`  
`Follow camera`  
`Free camera`  
`Cinematic camera`  
`Camera shake`  
`Camera lag`  
`Camera smoothing`  
`Look-at`  
`Damping`  
`Spring arm`  
`Framing`

A useful prompt:

> “Create a third-person spring-arm camera with collision avoidance, camera lag and smooth orbit controls.”

That's a **real game-engine sentence**.

---

# 14. Input

Learn:

`Input mapping`  
`Action mapping`  
`Axis input`  
`Digital input`  
`Analog input`  
`Mouse delta`  
`Pointer lock`  
`Gamepad`  
`Dead zone`  
`Sensitivity`  
`Key binding`  
`Control scheme`

For browser games, the platform APIs include Gamepad and Pointer Lock APIs, which are particularly relevant for game-style controls.

---

# 15. AI / NPC behavior

Don't just think:

> “Add AI.”

There are multiple architectures.

### Finite State Machine

```text
Idle
 │
player detected
 ↓
Chase
 │
near player
 ↓
Attack
 │
player escapes
 ↓
Search
```

Vocabulary:

`FSM`  
`State machine`  
`Transition`  
`State`

### Behavior Tree

```text
Selector
 ├── Attack
 ├── Chase
 └── Patrol
```

Vocabulary:

`Behavior tree`  
`Selector`  
`Sequence`  
`Decorator`  
`Blackboard`  
`Task`

Unreal's current Gameplay Framework commonly connects AI Controllers, Pawns, behavior trees and navigation. citeturn374925search0turn374925search10

### Utility AI

Instead of fixed transitions:

```text
Attack = 0.8
Flee   = 0.3
Patrol = 0.1
```

choose the highest utility.

Vocabulary:

`Utility AI`  
`Scoring`  
`Consideration`

This becomes useful when behavior gets complicated.

---

# 16. Navigation

For NPCs:

`NavMesh`  
`Navigation mesh`  
`Pathfinding`  
`A*`  
`Waypoint`  
`Navigation agent`  
`Path smoothing`  
`Steering`  
`Obstacle avoidance`

Conceptually:

```text
NPC
 │
 ↓
NavMesh
 │
 ↓
Path
 │
 ↓
Steering
 │
 ↓
Movement
```

---

# 17. Level design vocabulary

This will help enormously when you tell Codex what world you want.

`Level`  
`Map`  
`POI`  
`Landmark`  
`Spawn point`  
`Checkpoint`  
`Trigger volume`  
`Gameplay volume`  
`Kill volume`  
`Arena`  
`Open world`  
`Hub world`  
`Corridor`  
`Set piece`  
`Encounter`  
`Traversal space`  
`Combat space`

For an open-world-like site:

```text
World
 ├── District
 │    ├── Street
 │    ├── Building
 │    └── POI
 ├── District
 └── District
```

---

# 18. Open-world vocabulary

This is where the “GTA-like” discussion gets interesting.

`World streaming`  
`Chunk`  
`Sector`  
`Cell`  
`Streaming volume`  
`Level streaming`  
`Asset streaming`  
`Background loading`  
`World partition`  
`Origin rebasing`  
`Floating origin`  
`Spatial partitioning`  
`LOD`  
`HLOD`

Why?

You cannot keep the entire world at maximum detail all the time.

```text
                   WORLD

      ┌─────────────────────────────┐
      │ City                        │
      │                             │
      │   [A] [B] [C] [D] [E]      │
      │          ↑                  │
      │       player               │
      └─────────────────────────────┘

Nearby:
high detail

Far away:
low detail

Very far:
not loaded
```

This is one of the key reasons large games are hard.

---

# 19. LOD

`Level of Detail`

Example:

```text
Object distance

0–30m
  ↓
LOD0
10,000 triangles

30–100m
  ↓
LOD1
3,000 triangles

100–300m
  ↓
LOD2
500 triangles

300m+
  ↓
billboard / impostor
```

Vocabulary:

`LOD`  
`LOD bias`  
`LOD transition`  
`Impostor`  
`Billboard`  
`HLOD`

---

# 20. Culling

Never render things the player cannot see.

`Frustum culling`  
`Occlusion culling`  
`Portal culling`  
`Distance culling`  
`Visibility culling`

Basic idea:

```text
Camera
   ↓
Viewing frustum

         ┌─────────┐
        /           \
       /  visible    \
      /               \
     /_________________\

objects outside
       ↓
don't render
```

Three.js and R3F performance guidance emphasizes reducing expensive objects and draw calls, and `InstancedMesh` specifically exists to render many copies of shared geometry/material with fewer draw calls. citeturn176771search5turn176771search4

---

# 21. Instancing

Suppose a forest has:

```text
10,000 trees
```

Naive:

```text
tree
tree
tree
tree
...
```

Could mean enormous rendering overhead.

Instancing:

```text
ONE geometry
ONE material
        ↓
10,000 transforms
```

Three.js's `InstancedMesh` is explicitly designed for large numbers of objects sharing geometry/material, reducing draw calls. citeturn176771search5

This is a **fantastic prompt word**.

> “Use instanced rendering for repeated vegetation.”

---

# 22. Batching

Related vocabulary:

`Batching`  
`Dynamic batching`  
`Static batching`  
`Draw call`  
`GPU submission`  
`Material batching`

The basic idea:

```text
bad

draw
draw
draw
draw
draw
draw
```

versus:

```text
better

one larger submission
```

---

# 23. Draw calls

This is one of the most important performance words in WebGL/WebGPU.

You can have:

```text
10,000 polygons
```

and still be fine.

But:

```text
10,000 expensive draw calls
```

can be disastrous.

So:

```text
polygon count ≠ complete performance picture
```

Also watch:

```text
CPU
GPU
memory
shader cost
draw calls
overdraw
fill rate
```

---

# 24. Overdraw

A surprisingly important graphics concept.

If you draw:

```text
sky
building
glass
particle
UI
```

but several layers overlap the same pixels, the GPU may process pixels multiple times.

Vocabulary:

`Overdraw`  
`Fill rate`  
`Transparency sorting`  
`Alpha blending`

---

# 25. Post-processing

After rendering the scene, you can process the image.

```text
Scene
  ↓
Render target
  ↓
Post-processing
  ├── Bloom
  ├── Depth of field
  ├── Motion blur
  ├── Color grading
  ├── SSAO/SSGI
  └── Vignette
  ↓
Screen
```

Three.js's WebGPU post-processing stack now supports MRT and combines effects when possible to reduce render passes. citeturn374925search3

Prompt:

> “Add restrained bloom and depth-of-field post-processing, but keep the effect budget low enough for mid-range hardware.”

---

# 26. Particles / VFX

Learn:

`Particle system`  
`Particle emitter`  
`Particle lifetime`  
`Spawn rate`  
`Velocity field`  
`Sprite sheet`  
`Billboard particle`  
`GPU particles`  
`GPU simulation`  
`Trail`  
`Beam`  
`Burst`

This gives you vocabulary for:

```text
fire
smoke
rain
dust
sparks
explosions
magic
```

---

# 27. Audio

Game audio is its own system.

`Sound effect`  
`Music`  
`Ambient audio`  
`Spatial audio`  
`3D audio`  
`Attenuation`  
`Doppler`  
`Reverb`  
`Audio listener`  
`Audio source`  
`Mixer`  
`Audio bus`

For web games, the Web Audio API is the browser-level foundation; Godot's current web export also uses Web Audio for web playback. citeturn751769search0

---

# 28. Asset pipeline

This is a huge hidden world.

```text
Blender
   ↓
Model
   ↓
Rig
   ↓
Textures
   ↓
Export
   ↓
glTF / GLB
   ↓
Compression
   ↓
Browser
   ↓
GPU
```

Vocabulary:

`Asset pipeline`  
`Importer`  
`Exporter`  
`Runtime asset`  
`Texture compression`  
`Mesh compression`  
`Draco`  
`Meshopt`  
`glTF`  
`GLB`  
`LOD generation`  
`Texture atlas`  
`Sprite atlas`

glTF is the Khronos runtime 3D asset format, and the specification supports extensions for additional material/asset capabilities. citeturn748633search12turn748633search3

---

# 29. Texture atlasing

Instead of:

```text
1000 individual textures
```

you can sometimes create:

```text
┌────────────────────┐
│ wall │ metal │ door │
│------│-------│------│
│ wood │ sign  │road  │
└────────────────────┘
```

One texture contains many regions.

Vocabulary:

`Texture atlas`  
`UV packing`  
`Atlas coordinates`

This can help reduce state changes/draw calls in appropriate pipelines.

---

# 30. Web-specific game technology

This is where your Three.js interest becomes particularly relevant.

```text
Browser
   │
   ├── Canvas
   │
   ├── WebGL
   │
   ├── WebGPU
   │
   ├── WebAssembly
   │
   ├── Web Workers
   │
   ├── OffscreenCanvas
   │
   ├── Gamepad API
   │
   ├── Pointer Lock
   │
   ├── Web Audio
   │
   └── WebXR
```

WebGPU gives the browser access to modern GPU rendering and compute capabilities, though browser support remains less universal than WebGL. MDN still labels WebGPU as not Baseline because it is not available in some widely used browsers. citeturn748633search10

Three.js's WebGPU renderer is now significantly more mature, but its own documentation still notes that some scenes/features can work better through WebGL, so a fallback strategy remains sensible. citeturn374925search4

---

# 31. WebAssembly

This is particularly relevant to the “GTA in a browser” thing.

```text
Native/C/C++
     ↓
compiler
     ↓
WebAssembly
     ↓
Browser
```

Vocabulary:

`WASM`  
`Emscripten`  
`WASI`  
`WebAssembly module`  
`JS/WASM boundary`  
`WASM memory`  
`SIMD`  
`Threading`

Godot's web export, for example, produces a WebAssembly engine module, and browser game execution depends on WebAssembly and WebGL 2.0. citeturn751769search0

So there are really two very different approaches:

```text
A)

Build a web-native game

TypeScript
+
Three.js
+
WebGPU


B)

Port an existing native game

C/C++
     ↓
WebAssembly
```

Those are radically different engineering tasks.

---

# 32. Web Workers

This is another interesting modern browser concept.

```text
Main Thread
   │
   ├── UI
   ├── input
   └── rendering

Worker
   │
   ├── simulation
   ├── pathfinding
   └── heavy computation
```

Vocabulary:

`Web Worker`  
`OffscreenCanvas`  
`SharedArrayBuffer`  
`Atomics`  
`Worker communication`  
`Transferable objects`

Modern experimental web-game engines are exploring exactly this type of architecture: ECS simulation in a worker, WebGPU rendering on the main thread, snapshots across the boundary. That's visible in current open-source WebGPU/ECS work. citeturn678868search8turn678868search9

That architecture is worth understanding even if you don't use it immediately.

---

# 33. ECS

This is probably the **single game-development architecture term I most want you to know**.

Entity Component System:

```text
Entity
  │
  ├── Transform
  ├── Velocity
  ├── Health
  └── Renderable


Systems

MovementSystem
PhysicsSystem
HealthSystem
RenderSystem
```

The important distinction:

```text
Entity = identity

Component = data

System = behavior
```

Unity's current Entities package is an ECS implementation, and current web-engine experiments are also increasingly using ECS-style architecture for large-scale simulations. citeturn751769search1turn678868search8

For browser Three.js projects, a useful architecture can be:

```text
ECS
 │
 ▼
simulation state
 │
 ▼
Render Bridge
 │
 ▼
Three.js
 │
 ▼
GPU
```

That keeps **game state separate from rendering state**, which is a very strong architecture at scale. citeturn678868search1turn678868search9

---

# 34. Multiplayer networking

This is another gigantic vocabulary tree.

```text
Client
   │
   │ input
   ↓
Server
   │
   │ authoritative state
   ↓
Clients
```

Learn:

`Authoritative server`  
`Client-server architecture`  
`State synchronization`  
`Snapshot`  
`Tick rate`  
`Network tick`  
`Latency`  
`RTT`  
`Jitter`  
`Packet loss`  
`Client prediction`  
`Server reconciliation`  
`Interpolation`  
`Extrapolation`  
`Lag compensation`  
`Rollback netcode`  
`Interest management`  
`Entity replication`  
`State replication`

---

# 35. Client prediction

Classic example:

```text
Player presses RIGHT

Client:
move immediately

       ↓

Server:
receives input later

       ↓

Server:
authoritative position

       ↓

Client:
reconcile with server
```

Without prediction:

```text
input
 ↓
wait for network
 ↓
move
```

which feels terrible at high latency.

With prediction:

```text
input
 ↓
local simulation immediately
 ↓
server confirmation later
```

---

# 36. Interpolation

Suppose server snapshots are:

```text
T1: player x=10
T2: player x=20
```

Instead of teleporting:

```text
10
      ↓
20
```

you smoothly interpolate.

Vocabulary:

`Snapshot interpolation`  
`Interpolation buffer`  
`Render delay`  
`Extrapolation`

This is one of the fundamental ideas behind smooth multiplayer movement.

---

# 37. Rollback netcode

Especially relevant to fighting games.

```text
Local prediction
     ↓
later discover disagreement
     ↓
rollback
     ↓
re-simulate
     ↓
correct state
```

Vocabulary:

`Rollback`  
`Resimulation`  
`Input history`  
`Deterministic simulation`

---

# 38. Interest management

Open-world multiplayer cannot replicate everything to everyone.

```text
                    WORLD

   ┌──────────────────────────────┐
   │ A       B             C      │
   │                              │
   │         PLAYER               │
   │                              │
   │ D              E            │
   └──────────────────────────────┘

Player sees:
A, B, D

Server doesn't need to constantly send:
C, E
```

Vocabulary:

`Interest management`  
`Area of interest`  
`Visibility set`  
`Spatial filtering`  
`Replication culling`

---

# 39. Saving / persistence

`Save state`  
`Checkpoint`  
`Save slot`  
`Serialization`  
`Deserialization`  
`Versioned save data`  
`Migration`  
`Snapshot`

This is where game state becomes application data.

---

# 40. Procedural generation

Very useful if you want huge worlds.

`Procedural generation`  
`Noise`  
`Perlin noise`  
`Simplex noise`  
`Worley noise`  
`Seed`  
`Deterministic generation`  
`Biome generation`  
`Heightmap`  
`Procedural terrain`  
`Grammar-based generation`  
`Wave Function Collapse`  
`Dungeon generation`

Example:

```text
seed
 ↓
noise
 ↓
heightmap
 ↓
terrain
 ↓
biomes
 ↓
roads
 ↓
buildings
```

---

# 41. World generation vs level design

Don't confuse these.

```text
Procedural generation
=
algorithm creates content

Level design
=
human intentionally structures player experience
```

A generated city can still need carefully designed:

```text
POIs
encounters
missions
routes
landmarks
```

---

# 42. Game feel vocabulary

This category is especially useful when prompting Codex.

Learn:

`Game feel`  
`Juice`  
`Hit stop`  
`Hit pause`  
`Screen shake`  
`Squash and stretch`  
`Anticipation`  
`Follow-through`  
`Impact feedback`  
`Camera shake`  
`Trails`  
`Particles`  
`Motion smear`  
`Slow motion`  
`Time dilation`

Example:

> “Make the attack feel punchier using a 60 ms hit-stop, subtle camera shake, impact particles and a short recoil animation.”

That is vastly more actionable than:

> “Make attacks feel powerful.”

---

# 43. Animation principles

Learn some actual animation vocabulary:

`Anticipation`  
`Squash and stretch`  
`Follow-through`  
`Secondary motion`  
`Ease in/out`  
`Overshoot`  
`Settle`  
`Pose-to-pose`  
`Motion arc`  
`Weight shift`

Now your prompting vocabulary starts crossing:

```text
Game design
+
Animation
+
UI
```

---

# 44. UI/HUD game vocabulary

Since we already covered general UI:

`HUD`  
`Health bar`  
`Crosshair`  
`Minimap`  
`Quest marker`  
`Damage indicator`  
`Reticle`  
`Inventory screen`  
`Radial menu`  
`Pause menu`  
`Dialogue box`  
`World-space UI`  
`Screen-space UI`  
`Diegetic UI`  
`Non-diegetic UI`

### Diegetic UI

UI exists **inside the game world**.

Example:

```text
car dashboard
```

### Non-diegetic UI

UI exists only for the player.

Example:

```text
health bar
```

This distinction is extremely useful for game design prompts.

---

# 45. Game architecture vocabulary

At larger scale you will see:

`Game state`  
`Game mode`  
`Game manager`  
`Subsystem`  
`Event bus`  
`Message bus`  
`Command pattern`  
`State machine`  
`ECS`  
`Data-driven design`  
`Component architecture`  
`Dependency injection`  
`Resource manager`  
`Asset manager`  
`Object pool`

One particularly useful concept:

### Object pooling

Instead of:

```text
create bullet
destroy bullet
create bullet
destroy bullet
```

use:

```text
Bullet Pool
 ├── inactive
 ├── active
 ├── active
 └── inactive
```

Then reuse objects.

Excellent for:

```text
bullets
particles
NPCs
projectiles
effects
```

---

# 46. The “large game” performance vocabulary

Learn these as a cluster:

```text
Draw calls
GPU bound
CPU bound
Fill rate
Overdraw
Frustum culling
Occlusion culling
LOD
HLOD
Instancing
Batching
Texture atlas
Texture compression
Mesh compression
Asset streaming
World streaming
Object pooling
BVH
Spatial partitioning
Worker threads
OffscreenCanvas
GPU particles
Shader compilation
Shader cache
Pipeline compilation
Memory budget
VRAM budget
```

---

# 47. Shader/pipeline compilation

This is particularly important in modern WebGPU.

You can get:

```text
game running
    ↓
new shader/material/light configuration
    ↓
pipeline compilation
    ↓
stutter
```

So modern engines increasingly care about:

`Pipeline caching`  
`Shader warm-up`  
`Precompilation`  
`Material reuse`  
`Pipeline variants`

This is exactly the kind of subtle production issue you would never discover from a “make a spinning cube” tutorial.

---

# 48. Engine comparison

This is how I'd mentally categorize the popular choices:

```text
                    GAME DEVELOPMENT
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
      Engine             Renderer          Framework
        │                  │                  │
 Unity / Godot         Three.js          React
 Unreal                WebGPU            Next.js
 Babylon               WebGL
 PlayCanvas
```

More concretely:

### Three.js

Best when:

```text
custom 3D web experience
interactive 3D website
custom rendering
custom game architecture
```

Three.js gives you low-/mid-level rendering primitives rather than a full opinionated game editor. citeturn374925search11

### React Three Fiber

Best when:

```text
React application
        +
3D scene
```

R3F is a React renderer for Three.js and its current ecosystem includes Drei, Rapier integration, XR, postprocessing and more. citeturn176771search0

### Babylon.js

More engine-like:

```text
rendering
physics
animation
XR
scene management
```

and supports WebGL/WebGPU paths. citeturn748633search16turn748633search2

### PlayCanvas

Also much closer to a web game engine:

```text
engine
scene
assets
animation
physics
graphics
UI
XR
```

Its current Engine V2 supports WebGL2 and WebGPU, with WebGL fallback. citeturn748633search4turn748633search8

### Godot

A real game engine that can export to the web, but current Godot 4 web export targets WebGL 2 and WebAssembly; Forward+/Mobile rendering modes are not supported on web and Godot currently does not use WebGPU for that web renderer. citeturn751769search0

### Unity / Unreal

Much larger conventional game-engine environments.

Unity has ECS/DOTS capabilities; Unreal has its extensive Gameplay Framework with Actors, Pawns, Controllers, GameMode, GameState, AI and more. citeturn751769search1turn374925search0

---

# 49. What should YOU probably use?

For the kind of things you've been talking about:

```text
3D website
interactive portfolio
experimental web game
game-like visualization
scroll-driven 3D experience
```

I'd start with:

```text
Next.js
 +
React
 +
React Three Fiber
 +
Three.js
 +
Drei
 +
Rapier
 +
Motion
```

And then:

```text
WebGPU
```

when the project actually needs its capabilities.

R3F's current docs show first-class WebGPU work in v10, and its ecosystem already includes Drei, Rapier, postprocessing, XR, offscreen rendering and other useful pieces. citeturn748633search9turn176771search0

---

# 50. The mental model I want you to retain

When you think:

> “Build me a GTA-like city game.”

translate that mentally into:

```text
GAME

World
 ├── terrain
 ├── roads
 ├── buildings
 ├── vehicles
 └── NPCs

Simulation
 ├── game loop
 ├── physics
 ├── AI
 ├── navigation
 └── gameplay state

Rendering
 ├── scene graph
 ├── meshes
 ├── materials
 ├── lighting
 ├── shaders
 ├── shadows
 └── post-processing

Animation
 ├── skeletal animation
 ├── blend
 ├── state machine
 └── IK

Input
 ├── keyboard
 ├── mouse
 ├── gamepad
 └── pointer lock

Performance
 ├── culling
 ├── LOD
 ├── instancing
 ├── batching
 ├── streaming
 └── memory budget

AI
 ├── FSM / behavior tree
 ├── navmesh
 └── steering

Networking
 ├── authoritative server
 ├── prediction
 ├── interpolation
 └── reconciliation

Assets
 ├── Blender
 ├── glTF/GLB
 ├── textures
 └── compression

Web runtime
 ├── WebGL/WebGPU
 ├── WebAssembly
 ├── workers
 └── browser APIs
```

That is the **game-development map**.

---

# The 30 words I would learn first

Don't attempt the whole vocabulary at once.

Start with these:

```text
01. Game loop
02. Fixed timestep
03. Scene graph
04. Transform
05. Local space / world space
06. Mesh
07. Geometry
08. Material
09. Texture
10. PBR

11. Shader
12. Vertex shader
13. Fragment shader
14. Camera
15. Frustum culling
16. Draw call
17. Instancing
18. LOD
19. Asset streaming
20. ECS

21. Rigid body
22. Collider
23. Raycast
24. NavMesh
25. Behavior tree
26. Animation state machine
27. Skeletal animation
28. Client prediction
29. Interpolation
30. Rollback
```

Once those are familiar, a prompt like this becomes understandable:

> **“Build a third-person WebGPU/R3F demo with an ECS-driven simulation, a fixed-step physics loop, Rapier colliders, a hierarchical scene graph, GLB assets with PBR materials, a locomotion animation state machine, NavMesh-driven NPCs, frustum culling and instanced vegetation. Use a third-person spring-arm camera with smooth damping, add a small post-processing chain, and stream the world by spatial cells.”**

You don't necessarily need to know how to implement all of it.

But now you can **say what you want**.

And that's exactly the skill you're trying to develop with these vocabulary maps.

The most interesting modern direction I found is that web game development is starting to converge on architectures that look surprisingly similar to serious native game engines: **ECS as authoritative simulation state, a render bridge, worker-based simulation, WebGPU rendering, asset streaming, and explicit GPU/resource management**. Current experimental/open-source projects around WebGPU are already exploring this architecture. citeturn678868search8turn678868search9

So I would treat **game development as four overlapping subjects**, not one:

```text
GAME DESIGN
     +
GAME PROGRAMMING
     +
COMPUTER GRAPHICS
     +
REAL-TIME SYSTEMS
```

And **that fourth one—real-time systems—is the bridge to everything we've already studied in backend/frontend engineering.**