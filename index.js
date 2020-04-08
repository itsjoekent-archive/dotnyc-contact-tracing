import { Vector2 } from 'mr.ringer';

const CELL_RADIUS = 0.005;
const GOAL_RADIUS = 0.005;
const INFECTION_RADIUS = 0.02;
const CELL_SPEED = 0.0001;

const INITIAL_CELLS = 50;
const INITIAL_INFECTIONS = 2;

const RESPAWN_RATE = 200;
const RESPAWN_INFECTION_RATE = 0.1;
const MAX_POPULATION = 200;

const TESTING_FREQUENCY = 3500;
const TESTING_CHANCE = 0.45;
const QUARANTINE_LIFE = 3000;
const NOTIFICATION_DELAY = 1000;
const INFECTION_DELAY = 500;

const TEST_HIGHLIGHT_DIMENSIONS = [0.02, 0.005];

const COLORS = {
  RED: '#8b0000',
  BLUE: '#9fcfff',
  GRAY: '#40464b',
  WHITE: '#FFFFFF',
};

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function circleIntersection(positionA, radiusA, positionB, radiusB) {
  const distanceX = positionA.x - positionB.x;
  const distanceY = positionA.y - positionB.y;
  const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

  return distance < radiusA + radiusB;
}

function simulation() {
  const canvas = document.getElementById('viz');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  function view(vector) {
    return [
      canvas.width * vector.x,
      canvas.height * vector.y,
    ];
  }

  function makeCell() {
    return ({
      id: Math.round(Math.random() * 1000000),
      position: Vector2(Math.random(), Math.random()),
      infectedAt: null,
      isIndexCase: false,
      quarantinedAt: null,
      quarantinedBy: null,
      lastTested: Date.now(),
      contacts: [],
      hasNotifiedContacts: false,
      travelTarget: Math.random() > 0.25 ? Vector2(Math.random(), Math.random()) : null,
      lastTraveled: Date.now(),
      travelFrequency: Math.random(),
    });
  }

  const ctx = canvas.getContext('2d');

  const cells = new Array(INITIAL_CELLS).fill({}).map((cell) => makeCell());

  for (let i = 0; i < INITIAL_INFECTIONS; i++) {
    cells[getRandomInt(0, cells.length)].infectedAt = Date.now();
  }

  function quarantine(id, contacts) {
    contacts.forEach((contactId) => {
      const contactIndex = cells.findIndex((cell) => cell.id === contactId);
      if (contactIndex === -1) {
        return;
      }

      if (!cells[contactIndex].quarantinedAt) {
        cells[contactIndex].quarantinedAt = Date.now();
        cells[contactIndex].quarantinedBy = id;
      }
    });
  }

  let lastTick = Date.now();
  let lastRespawn = Date.now();
  let stop = false;

  function loop() {
    if (stop) {
      return;
    }

    const delta = Date.now() - lastTick;
    lastTick = Date.now();

    ctx.save();

    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (Date.now() - lastRespawn > RESPAWN_RATE && cells.length < MAX_POPULATION) {
      const newCell = makeCell();

      newCell.position = Vector2(
        Math.random() + (Math.round(Math.random()) || -1),
        Math.random() + (Math.round(Math.random()) || -1),
      );

      newCell.travelTarget = Vector2(Math.random(), Math.random());

      if (Math.random() < RESPAWN_INFECTION_RATE) {
        newCell.infectedAt = Date.now();
      }

      cells.push(newCell);
      lastRespawn = Date.now();
    }

    cells.forEach((_original, index) => {
      const cell = { ..._original };

      const isInfected = !!cell.infectedAt;
      const isQuarantined = !!cell.quarantinedAt;

      if (!isQuarantined) {
        if (cell.travelTarget) {
          const velocity = Vector2.subtract(cell.travelTarget, cell.position).normalize().scale(CELL_SPEED * delta);

          cell.position.add(velocity);

          if (circleIntersection(cell.position, CELL_RADIUS, cell.travelTarget, GOAL_RADIUS)) {
            cell.travelTarget = null;
            cell.lastTraveled = Date.now();
          }

          if (cell.position.x > 2.1) {
            cell.position.x = 0;
          } else if (cell.position.x < -2.1) {
            cell.position.x = 1;
          }

          if (cell.position.y > 2.1) {
            cell.position.y = 0;
          } else if (cell.position.y < -2.1) {
            cell.position.y = 1;
          }
        } else if (cell.lastTraveled > 1000 && cell.travelFrequency > Math.random()) {
          cell.travelTarget = new Vector2(Math.random(), Math.random());
        }
      }

      if (isInfected && !isQuarantined && Date.now() - cell.infectedAt > INFECTION_DELAY) {
        cells.forEach((compare, compareIndex) => {
          if (compare.infectedAt || compare.quarantinedAt) {
            return;
          }

          if (circleIntersection(cell.position, INFECTION_RADIUS, compare.position, INFECTION_RADIUS)) {
            cell.contacts.push(compare.id);
            cells[compareIndex].infectedAt = Date.now();

            if (!cells[compareIndex].contacts.includes(cell.id)) {
              cells[compareIndex].contacts.push(cell.id);
            }
          }
        });
      }

      if (Date.now() - cell.lastTested > TESTING_FREQUENCY && Math.random() > TESTING_CHANCE) {
        cell.lastTested = Date.now();

        if (isInfected && !isQuarantined && cell.contacts.length) {
          cell.quarantinedAt = Date.now();
          cell.isIndexCase = true;
        }
      }

      if (isQuarantined && !cell.hasNotifiedContacts && Date.now() - cell.quarantinedAt > NOTIFICATION_DELAY) {
        cell.hasNotifiedContacts = true;
        quarantine(cell.id, cell.contacts);
      }

      cells[index] = cell;

      const [cellDrawX, cellDrawY] = view(cell.position);

      const cellDrawRadius = canvas.width * CELL_RADIUS;
      const infectionDrawRadius = canvas.width * INFECTION_RADIUS;

      ctx.fillStyle = COLORS.BLUE;
      ctx.globalAlpha = 1;

      if (isInfected && !isQuarantined) {
        ctx.fillStyle = COLORS.RED;
        ctx.strokeStyle = COLORS.RED;
      } else if (isQuarantined) {
        ctx.fillStyle = COLORS.GRAY;
        ctx.strokeStyle = COLORS.GRAY;

        const timeElapsed = Date.now() - cell.quarantinedAt;
        ctx.globalAlpha = 1 - (timeElapsed / QUARANTINE_LIFE);

        if (timeElapsed > QUARANTINE_LIFE) {
          cells.splice(index, 1);
          return;
        }
      }

      if (isQuarantined && cell.isIndexCase && !cell.quarantinedBy) {
        const topLeftCorner = view(Vector2(
          cell.position.x - (TEST_HIGHLIGHT_DIMENSIONS[1] / 2),
          cell.position.y - (TEST_HIGHLIGHT_DIMENSIONS[0] / 2),
        ));

        const bottomRightCorner = view(Vector2(
          TEST_HIGHLIGHT_DIMENSIONS[1],
          TEST_HIGHLIGHT_DIMENSIONS[0],
        ));

        ctx.fillRect(...topLeftCorner, ...bottomRightCorner);

        const middleLeftCorner = view(Vector2(
          cell.position.x - (TEST_HIGHLIGHT_DIMENSIONS[0] / 2),
          cell.position.y - (TEST_HIGHLIGHT_DIMENSIONS[1] / 2),
        ));

        const middleRightCorner = view(Vector2(
          TEST_HIGHLIGHT_DIMENSIONS[0],
          TEST_HIGHLIGHT_DIMENSIONS[1],
        ));

        ctx.fillRect(...middleLeftCorner, ...middleRightCorner);
      } else {
        ctx.beginPath();
        ctx.arc(cellDrawX, cellDrawY, cellDrawRadius, 0, Math.PI * 2, true);
        ctx.fill();
      }

      if (isInfected) {
        // ctx.setLineDash([10, 10]);
        // ctx.beginPath();
        // ctx.arc(cellDrawX, cellDrawY, infectionDrawRadius, 0, Math.PI * 2, true);
        //
        // ctx.lineWidth = 1;
        // ctx.stroke();

        cell.contacts.forEach((contactId) => {
          const contact = cells.find((cell) => cell.id === contactId);
          if (!contact) {
            return;
          }

          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(cellDrawX, cellDrawY);
          ctx.lineTo(...view(contact.position));
          ctx.stroke();
        });
      }
    });

    ctx.restore();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return () => stop = true;
}

(function() {
  const resetButton = document.getElementById('reset');

  let stop = simulation();

  resetButton.addEventListener('click', () => {
    stop();
    stop = simulation();
  });
})();
