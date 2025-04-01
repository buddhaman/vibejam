import { Level } from './Level';
import { Game } from './Game';
import { Serialize } from './Serialize';

export const tutorial_level = {
  "name": "Tutorial Level",
  "author": "Level Editor",
  "version": 1,
  "created": "2025-04-01T09:05:53.207Z",
  "platforms": [
    {
      "position": [
        0,
        -4,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        100,
        3,
        100
      ],
      "color": "#ff8888",
      "name": ""
    },
    {
      "position": [
        -3.318727521972048,
        14.096047623476675,
        -46.5
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        18.3,
        4,
        36.6
      ],
      "color": "#ff0000",
      "name": ""
    },
    {
      "position": [
        -2,
        4,
        -1.5
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        21.200000000000003,
        4,
        19.200000000000003
      ],
      "color": "#ff0000",
      "name": ""
    },
    {
      "position": [
        -2.5,
        2,
        15
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        4,
        4,
        4
      ],
      "color": "#ff0000",
      "name": ""
    },
    {
      "position": [
        -20,
        1,
        21
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        22,
        4,
        16
      ],
      "color": "#ff0000",
      "name": ""
    }
  ],
  "ropes": [
    {
      "startPos": [
        -3.5,
        41.5,
        -23.5
      ],
      "endPos": [
        -3.5632050561070767,
        19.191100667087472,
        -23.750747138426842
      ],
      "length": 20,
      "segments": 14,
      "name": "Rope"
    }
  ],
  "saws": [
    {
      "position": [
        -12,
        20,
        -22.04921809365678
      ],
      "rotation": [
        -1.4619546048150494,
        0.6395909717003178,
        3.047289551307195
      ],
      "radius": 4,
      "thickness": 1,
      "spinSpeed": 0.1,
      "name": "saw_1743498353207"
    },
    {
      "position": [
        6,
        20.5,
        -21.5
      ],
      "rotation": [
        0,
        0,
        -0.5300164692441713
      ],
      "radius": 4,
      "thickness": 1,
      "spinSpeed": 0.1,
      "name": "saw_1743498353207"
    }
  ],
  "actionAreas": [
    {
      "position": [
        -20.963095081297276,
        7.5,
        22
      ],
      "size": [
        8,
        8,
        8
      ],
      "triggerOnce": false,
      "name": "actionarea_1743498353207"
    }
  ],
  "playerStartPosition": [
    -3.311564302153283,
    23.42808941552309,
    -58.80787738458037
  ]
}

/**
 * Loads any JSON level data
 * @param level The Level instance to populate
 * @param game The Game instance for level switching
 * @param levelData The JSON level data to load
 */
export function loadJSONLevel(level: Level, game: Game, levelData: any): void {
    console.log(`Loading JSON level: ${levelData.name}`);
    
    // Convert to string for serialization
    const jsonString = JSON.stringify(levelData);
    
    // Use the existing Serialize.loadLevelFromString method
    const success = Serialize.loadLevelFromString(level, jsonString);

    // Go over all action areas and set the callback to go back to the overworld
    level.actionAreas.forEach(area => {
        area.callback = () => {
            game.switchLevel(0);
        };
        area.triggerOnce = true;
    });
    
    if (success) {
        console.log(`Successfully loaded ${levelData.name}`);
    } else {
        console.error(`Failed to load level: ${levelData.name}`);
    }
}