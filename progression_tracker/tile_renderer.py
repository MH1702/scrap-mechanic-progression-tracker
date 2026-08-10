"""Save-independent tile rendering adapter for pristine ScrapMap v2.0."""

import numpy as np

from smmap.render import NO_LIQUID, _orient, _smooth


def tile_image(renderer, tile, hillshade=True, water=True):
    """Render one complete tile as a north-up RGB image."""
    image, ground = renderer._tile_arrays(tile)
    image = image.copy()
    top = np.zeros(ground.shape, dtype=np.float32) if renderer.structures else None
    level = np.full(ground.shape, NO_LIQUID, dtype=np.float32)
    kinds = np.zeros(ground.shape, dtype=np.uint8)

    overlay = renderer.baker.bake(tile, ground) if renderer.baker else None
    if overlay is not None:
        if overlay.cover is not None:
            alpha = overlay.cover[:, :, None]
            image *= 1.0 - alpha
            image += overlay.rgb * alpha
            top[:] = overlay.top
        if overlay.surface is not None:
            level[:] = overlay.surface
            kinds[:] = overlay.kind

    if hillshade:
        shade = renderer._shade(_smooth(ground, 2))
        shade = np.where(ground < level, 1.0 + (shade - 1.0) * 0.25, shade)
        image *= shade[:, :, None]
    if top is not None:
        renderer._light_structures(image, top)
    if water:
        image = renderer._apply_water(image, ground, top, level, kinds)
    return _orient(np.clip(image, 0, 255).astype(np.uint8), 0)
