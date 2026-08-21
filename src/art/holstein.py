#!/usr/bin/env python3
"""Generate a shaded, high-resolution ASCII Holstein.

The cow is built as a union of primitives, given volume by an interior distance
transform, lit from the upper left, painted with Holstein patches, then quantised to a
ramp of ASCII characters ordered by ink coverage.

Also writes a greyscale PNG of the ink coverage per cell, which is what the art looks
like once the font is too small to read individual characters.
"""
import math
import struct
import sys
import zlib

COLS, ROWS = 160, 80
SS = 3  # supersample factor
W, H = COLS * SS, ROWS * SS

AMBIENT = 0.34
INK_MAX = 0.74  # coverage of the densest character in RAMP

# Canvas units: x in [0, 2], y in [0, 1]. Square cells, so no aspect correction.
AX, AY = 2.0, 1.0


def px_to_canvas(ix, iy):
    return (ix + 0.5) / W * AX, (iy + 0.5) / H * AY


# --------------------------------------------------------------------------- shapes
def ellipse(x, y, cx, cy, rx, ry, rot=0.0):
    dx, dy = x - cx, y - cy
    if rot:
        c, s = math.cos(-rot), math.sin(-rot)
        dx, dy = dx * c - dy * s, dx * s + dy * c
    return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1.0


def capsule(x, y, x0, y0, x1, y1, r0, r1):
    vx, vy = x1 - x0, y1 - y0
    L2 = vx * vx + vy * vy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - x0) * vx + (y - y0) * vy) / L2))
    px, py = x0 + t * vx, y0 + t * vy
    r = r0 + (r1 - r0) * t
    return (x - px) ** 2 + (y - py) ** 2 <= r * r


def body(x, y):
    if ellipse(x, y, 1.18, 0.46, 0.46, 0.235):
        return True
    if ellipse(x, y, 1.52, 0.44, 0.28, 0.245):  # hindquarters
        return True
    if ellipse(x, y, 0.88, 0.50, 0.24, 0.235):  # brisket, deeper than the barrel
        return True
    if ellipse(x, y, 0.98, 0.32, 0.10, 0.055):  # withers
        return True
    if ellipse(x, y, 1.44, 0.30, 0.09, 0.050):  # hook bone
        return True
    if ellipse(x, y, 1.36, 0.66, 0.115, 0.085):  # udder
        return True
    return False


def neck(x, y):
    return capsule(x, y, 0.82, 0.37, 0.47, 0.30, 0.20, 0.125)


def head(x, y):
    if ellipse(x, y, 0.37, 0.29, 0.155, 0.105, rot=0.30):
        return True
    if ellipse(x, y, 0.30, 0.345, 0.110, 0.070, rot=0.25):  # jaw
        return True
    if ellipse(x, y, 0.195, 0.375, 0.075, 0.062):  # muzzle
        return True
    return False


def ears(x, y):
    if ellipse(x, y, 0.480, 0.212, 0.078, 0.034, rot=-0.50):
        return True
    if ellipse(x, y, 0.432, 0.182, 0.058, 0.026, rot=-0.90):  # far ear
        return True
    return False


# (x0, y0, x1, y1, r0, r1, far) — shoulder or hip down to the hoof. The far pair sit in
# the body's shadow, so they carry a shading multiplier rather than a different shape.
LEGS = [
    (0.95, 0.62, 0.93, 0.930, 0.066, 0.036, True),
    (1.60, 0.61, 1.64, 0.930, 0.074, 0.038, True),
    (0.86, 0.63, 0.80, 0.950, 0.072, 0.040, False),
    (1.50, 0.62, 1.52, 0.950, 0.082, 0.042, False),
]


def legs(x, y):
    return any(capsule(x, y, *seg[:6]) for seg in LEGS)


def hooves(x, y):
    for x0, y0, x1, y1, r0, r1, _far in LEGS:
        if capsule(x, y, x1, y1 - 0.020, x1, y1, r1 * 1.18, r1 * 1.30):
            return True
    return False


def tail(x, y):
    # A slack curve down the rump, thickening into a tuft.
    for i in range(32):
        t = i / 31
        tx = 1.735 + 0.175 * t * t
        ty = 0.285 + 0.505 * t
        r = 0.030 * (1 - t) + 0.011
        if (x - tx) ** 2 + (y - ty) ** 2 <= r * r:
            return True
    return ellipse(x, y, 1.918, 0.845, 0.034, 0.058)  # tuft


def silhouette(x, y):
    return body(x, y) or neck(x, y) or head(x, y) or ears(x, y) or legs(x, y) or tail(x, y)


# --------------------------------------------------------------------- holstein coat
def patches(x, y):
    """Holstein markings: ellipses deformed by two low harmonics.

    Low frequencies only. Anything above about 3 turns the outline into a starfish,
    which is the tell that a shape was generated rather than grown.
    """
    blobs = [
        (1.50, 0.32, 0.190, 0.130, 2.0, 0.16, 0.7),
        (1.22, 0.56, 0.150, 0.110, 3.0, 0.14, 2.1),
        (0.99, 0.35, 0.145, 0.105, 2.0, 0.15, 4.0),
        (1.38, 0.45, 0.085, 0.065, 3.0, 0.13, 1.2),
        (0.81, 0.60, 0.092, 0.072, 2.0, 0.15, 5.2),
        (1.69, 0.56, 0.100, 0.082, 3.0, 0.14, 0.3),
        (0.455, 0.243, 0.062, 0.045, 2.0, 0.13, 2.7),
    ]
    for cx, cy, rx, ry, freq, amp, phase in blobs:
        dx, dy = x - cx, y - cy
        ang = math.atan2(dy, dx)
        wobble = 1.0 + amp * math.sin(freq * ang + phase) + amp * 0.45 * math.sin(2.0 * ang + phase * 1.9)
        if (dx / (rx * wobble)) ** 2 + (dy / (ry * wobble)) ** 2 <= 1.0:
            return True
    return False


def albedo_at(x, y):
    if hooves(x, y):
        return 0.09
    if ellipse(x, y, 0.195, 0.375, 0.075, 0.062):  # muzzle
        if ellipse(x, y, 0.170, 0.358, 0.017, 0.012, rot=0.4):  # nostril
            return 0.07
        return 0.42
    if ears(x, y) and not head(x, y):
        return 0.34
    if tail(x, y) and not body(x, y):
        return 0.26
    if patches(x, y):
        return 0.12
    return 0.95


def in_far_leg(x, y):
    return any(capsule(x, y, *seg[:6]) for seg in LEGS if seg[6])


def coat_noise(x, y):
    """A little high-frequency break-up, so the coat is not glassy.

    Hash-based rather than real noise: all it has to do at this resolution is stop large
    areas quantising to a single character, which is what reads as plastic.
    """
    n = math.sin(x * 511.7 + y * 197.3) * 43758.5453
    n -= math.floor(n)
    m = math.sin(x * 131.1 - y * 733.9) * 24634.6345
    m -= math.floor(m)
    return (n * 0.6 + m * 0.4) - 0.5


# ------------------------------------------------------------------ distance + light
def interior_depth(mask):
    """Chamfer distance transform, in pixels, of the interior."""
    INF = 1e9
    d = [0.0 if not mask[i] else INF for i in range(W * H)]
    a, b = 1.0, math.sqrt(2.0)
    for y in range(H):
        for x in range(W):
            i = y * W + x
            if d[i] == 0.0:
                continue
            best = d[i]
            if x > 0:
                best = min(best, d[i - 1] + a)
            if y > 0:
                best = min(best, d[i - W] + a)
                if x > 0:
                    best = min(best, d[i - W - 1] + b)
                if x < W - 1:
                    best = min(best, d[i - W + 1] + b)
            d[i] = best
    for y in range(H - 1, -1, -1):
        for x in range(W - 1, -1, -1):
            i = y * W + x
            best = d[i]
            if x < W - 1:
                best = min(best, d[i + 1] + a)
            if y < H - 1:
                best = min(best, d[i + W] + a)
                if x < W - 1:
                    best = min(best, d[i + W + 1] + b)
                if x > 0:
                    best = min(best, d[i + W - 1] + b)
            d[i] = best
    return d


AO_DIRECTIONS = [
    (math.cos(k * 2.399963) * (1.0 + 7.0 * k / 27.0) / 8.0, math.sin(k * 2.399963) * (1.0 + 7.0 * k / 27.0) / 8.0)
    for k in range(28)
]


def ambient_occlusion(mask, depth):
    """Fraction of a surrounding disc that is still inside the cow.

    Concave junctions — a leg meeting the barrel, under the jaw, between udder and thigh
    — sample fewer interior points and so darken. It is the cheapest thing that stops a
    union of ellipses looking like a union of ellipses.
    """
    R = 6.0 * SS
    offsets = [(int(round(dx * R)), int(round(dy * R))) for dx, dy in AO_DIRECTIONS]
    ao = [1.0] * (W * H)
    for iy in range(H):
        for ix in range(W):
            i = iy * W + ix
            if not mask[i] or depth[i] > R:  # deep inside: fully open, skip the sampling
                continue
            hits = 0
            for ox, oy in offsets:
                jx, jy = ix + ox, iy + oy
                if 0 <= jx < W and 0 <= jy < H and mask[jy * W + jx]:
                    hits += 1
            ao[i] = 0.45 + 0.55 * (hits / len(offsets))
    return ao


def build():
    mask = [False] * (W * H)
    alb = [0.0] * (W * H)
    for iy in range(H):
        for ix in range(W):
            x, y = px_to_canvas(ix, iy)
            if silhouette(x, y):
                i = iy * W + ix
                mask[i] = True
                alb[i] = albedo_at(x, y)

    depth = interior_depth(mask)

    # Bulge: treat normalised depth as height on a rounded surface.
    BULGE = 13.0 * SS
    lum = [0.0] * (W * H)
    for i in range(W * H):
        if not mask[i]:
            continue
        h = min(1.0, depth[i] / BULGE)
        z = math.sqrt(max(0.0, 1.0 - (1.0 - h) ** 2))  # 0 at the rim, 1 well inside
        lum[i] = z

    # Surface normal from the gradient of that height field, then a single light.
    LX, LY, LZ = -0.45, -0.72, 0.53
    n = math.sqrt(LX * LX + LY * LY + LZ * LZ)
    LX, LY, LZ = LX / n, LY / n, LZ / n

    ao = ambient_occlusion(mask, depth)

    out = [0.0] * (W * H)
    for iy in range(H):
        for ix in range(W):
            i = iy * W + ix
            if not mask[i]:
                continue
            gx = (lum[i + 1] if ix < W - 1 else lum[i]) - (lum[i - 1] if ix > 0 else lum[i])
            gy = (lum[i + W] if iy < H - 1 else lum[i]) - (lum[i - W] if iy > 0 else lum[i])
            nx, ny, nz = -gx * 2.2, -gy * 2.2, 0.55
            ln = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            nx, ny, nz = nx / ln, ny / ln, nz / ln
            diff = max(0.0, nx * LX + ny * LY + nz * LZ)

            x, y = px_to_canvas(ix, iy)
            v = alb[i] * (AMBIENT + (1.0 - AMBIENT) * diff) * ao[i]
            if in_far_leg(x, y):
                v *= 0.55  # the off-side pair sit in the body's shadow
            v *= 1.0 + 0.055 * coat_noise(x * 90.0, y * 90.0)
            # Tone curve into the ramp's usable range: pure white would clip a third of
            # the body to one character and throw the modelling away.
            out[i] = max(0.0, min(1.0, v ** 0.85)) * INK_MAX

    # The eye, painted last so nothing washes it out.
    for iy in range(H):
        for ix in range(W):
            x, y = px_to_canvas(ix, iy)
            if ellipse(x, y, 0.352, 0.272, 0.024, 0.019):
                out[iy * W + ix] = 0.04
            if ellipse(x, y, 0.344, 0.264, 0.009, 0.008):  # catchlight
                out[iy * W + ix] = INK_MAX
    return mask, out


# ------------------------------------------------------------------------ characters
# Printable ASCII only: Unicode block characters would read as a bitmap rather than as
# something built out of type, which is the whole charm. Coverage is by eye in a
# typical monospace face, ordered darkest-ink last.
RAMP = [
    (" ", 0.00), (".", 0.06), ("'", 0.08), (":", 0.13), ("-", 0.15), (";", 0.18),
    ("~", 0.20), ("!", 0.23), ("+", 0.28), ("=", 0.30), ("c", 0.33), ("v", 0.35),
    ("o", 0.38), ("s", 0.40), ("n", 0.43), ("w", 0.46), ("h", 0.48), ("d", 0.50),
    ("O", 0.53), ("0", 0.56), ("N", 0.59), ("M", 0.62), ("#", 0.66), ("%", 0.69),
    ("@", 0.74),
]


def to_chars(field):
    """Downsample to the character grid and pick the nearest coverage.

    Ink is bright on a dark panel, so luminance maps straight to coverage.

    The cell average is stretched so the brightest few cells land on the densest
    character. Supersampling pulls peaks toward the mean, so without this the top third
    of the ramp is never reached and the whole animal renders in the middle greys.
    """
    raw = []
    for cy in range(ROWS):
        row = []
        for cx in range(COLS):
            total = 0.0
            for sy in range(SS):
                base = (cy * SS + sy) * W + cx * SS
                for sx in range(SS):
                    total += field[base + sx]
            row.append(total / (SS * SS))
        raw.append(row)

    lit = sorted(v for row in raw for v in row if v > 0.0)
    ceiling = lit[int(len(lit) * 0.995)] if lit else 1.0
    gain = INK_MAX / ceiling if ceiling > 0 else 1.0

    rows, cells = [], []
    for cy in range(ROWS):
        line, crow = [], []
        for cx in range(COLS):
            v = min(INK_MAX, raw[cy][cx] * gain)
            ch, cov = min(RAMP, key=lambda rc: abs(rc[1] - v))
            line.append(ch)
            crow.append(cov)
        rows.append("".join(line).rstrip())
        cells.append(crow)
    return rows, cells


# ------------------------------------------------------------------------- png output
def write_png(path, w, h, grey):
    raw = b"".join(b"\x00" + bytes(grey[y * w : (y + 1) * w]) for y in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


def preview_png(path, cells, scale=4):
    w, h = COLS * scale, ROWS * scale
    grey = bytearray(w * h)
    for cy in range(ROWS):
        for cx in range(COLS):
            v = int(max(0.0, min(1.0, cells[cy][cx] / INK_MAX)) * 255)
            for sy in range(scale):
                base = (cy * scale + sy) * w + cx * scale
                for sx in range(scale):
                    grey[base + sx] = v
    write_png(path, w, h, grey)


if __name__ == "__main__":
    mask, field = build()
    rows, cells = to_chars(field)
    out = sys.argv[1] if len(sys.argv) > 1 else "cow"
    with open(f"{out}.txt", "w") as fh:
        fh.write("\n".join(rows) + "\n")
    preview_png(f"{out}.png", cells)
    ink = sum(1 for r in rows for c in r if c != " ")
    print(f"{COLS}x{ROWS}, {ink} inked cells, {len(rows)} rows -> {out}.txt / {out}.png")
