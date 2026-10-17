"""Kitchen zone classes shared by auto-labelling, training and the backend."""

KITCHEN_CLASSES = [
    "wall",
    "floor",
    "ceiling",
    "cabinet",
    "countertop",
    "stove",
    "sink",
    "fridge",
    "window",
    "hood",
    "door",
    # Open space under a bare platform where base cabinets go. Hand-labelled
    # only: ADE20K has no such class.
    "under_counter",
]

# ADE20K label name (as in the HF SegFormer config) -> kitchen class.
ADE_TO_KITCHEN = {
    "wall": "wall",
    "floor": "floor",
    "rug": "floor",
    "ceiling": "ceiling",
    "cabinet": "cabinet",
    "wardrobe": "cabinet",
    "chest of drawers": "cabinet",
    "shelf": "cabinet",
    "countertop": "countertop",
    "counter": "countertop",
    "kitchen island": "countertop",
    "stove": "stove",
    "oven": "stove",
    "sink": "sink",
    "refrigerator": "fridge",
    "windowpane": "window",
    "hood": "hood",
    "door": "door",
    "screen door": "door",
}

# Classes that prove the photo is a kitchen (used to reject living rooms etc.).
KITCHEN_EVIDENCE = {"cabinet", "countertop", "stove", "sink", "hood", "fridge"}

# Paint order for zone maps: big surfaces first, small objects on top.
PAINT_ORDER = [
    "ceiling",
    "wall",
    "floor",
    "door",
    "window",
    "under_counter",
    "cabinet",
    "fridge",
    "countertop",
    "hood",
    "stove",
    "sink",
]
