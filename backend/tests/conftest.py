"""
Mock all heavy ML/DB dependencies so server.py can be imported in tests
without loading models or connecting to a database.
"""
import sys
from unittest.mock import MagicMock

# numpy needs special handling: server.py calls isinstance(obj, np.integer)
# so np.integer / np.floating / np.ndarray must be real types, not MagicMocks.
_numpy_mock = MagicMock()

class _FakeNpInteger(int):   pass
class _FakeNpFloating(float): pass
class _FakeNpNdarray(list):   pass

_numpy_mock.integer = _FakeNpInteger
_numpy_mock.floating = _FakeNpFloating
_numpy_mock.ndarray = _FakeNpNdarray
sys.modules["numpy"] = _numpy_mock

MOCK_MODULES = [
    # Custom engines (load models on init — must be mocked first)
    "inference_engine",
    "tracking_engine",
    "team_attributor",
    # ML / CV packages  (numpy already handled above)
    "torch", "torchvision",
    "tensorflow", "tensorflow.keras",
    "keras", "keras.models", "keras.layers",
    "cv2", "imutils",
    "ultralytics",
    "supervision",
    "sklearn", "sklearn.decomposition", "sklearn.preprocessing",
    "moviepy", "moviepy.editor",
    "skvideo", "skvideo.io",
    "SoccerNet", "SoccerNet.Evaluation",
    "pandas",
    "matplotlib", "matplotlib.pyplot",
    "tqdm",
    # Cloud / DB drivers
    "huggingface_hub",
    "pyodbc",
]

for mod in MOCK_MODULES:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()
