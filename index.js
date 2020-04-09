import { Vector2 } from 'mr.ringer';

const CELL_RADIUS = 0.005;
const GOAL_RADIUS = 0.005;
const INFECTION_RADIUS = 0.02;
const TEST_OUTLINE_RADIUS = 0.015;
const CELL_SPEED = 0.0001;
const TRAVEL_PAUSE = 2000;

const INITIAL_CELLS = 50;

const RESPAWN_RATE = 200;
const RESPAWN_INFECTION_RATE = 0.1;
const MAX_POPULATION = 200;

const TESTING_FREQUENCY = 100;
const QUARANTINE_LIFE = 3000;
const NOTIFICATION_DELAY = 500;
const INFECTION_DELAY = 250;

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

function simulation(onPandemicEnd) {
  const canvas = document.getElementById('viz');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  function onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', onResize);

  function view(vector) {
    return [
      canvas.width * vector.x,
      canvas.height * vector.y,
    ];
  }

  function makeCell() {
    return ({
      id: `${Math.round(Math.random() * 1000000)}`,
      position: Vector2(Math.random(), Math.random()),
      infectedAt: null,
      infectedBy: null,
      quarantinedAt: null,
      contacts: [],
      hasNotifiedContacts: false,
      travelTarget: Math.random() > 0.25 ? Vector2(Math.random(), Math.random()) : null,
      lastTraveled: Date.now(),
      travelFrequency: Math.random(),
    });
  }

  const ctx = canvas.getContext('2d');

  const cells = new Array(INITIAL_CELLS)
    .fill({})
    .map((cell) => makeCell())
    .reduce((acc, cell) => ({ ...acc, [cell.id]: cell }), {});

  const initialInfectionId = Object.keys(cells)[getRandomInt(0, INITIAL_CELLS)];
  cells[initialInfectionId].infectedAt = Date.now();

  let indexCaseId = null;

  function quarantine(id, contacts) {
    contacts.forEach((contactId) => {
      if (!contactId || !cells[contactId]) {
        return;
      }

      if (!cells[contactId].quarantinedAt) {
        cells[contactId].quarantinedAt = Date.now();
      }
    });
  }

  let lastTick = Date.now();
  let lastRespawn = Date.now();
  let lastTest = Date.now();
  let stop = false;
  let hasPandemicEnded = false;

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

      cells[newCell.id] = newCell;

      lastRespawn = Date.now();
    }

    if (Date.now() - lastTest > TESTING_FREQUENCY) {
      const cellTestId = Object.keys(cells)[getRandomInt(0, Object.keys(cells).length)];

      if (cells[cellTestId].infectedAt && !cells[cellTestId].quarantinedAt && cells[cellTestId].contacts.length) {
        cells[cellTestId].quarantinedAt = Date.now();

        if (!indexCaseId) {
          indexCaseId = cellTestId;
        }
      }

      lastTest = Date.now();
    }

    Object.keys(cells).forEach((id) => {
      const cell = { ...cells[id] };

      const isInfected = !!cell.infectedAt;
      const isQuarantined = !!cell.quarantinedAt;

      if (isInfected && !isQuarantined && hasPandemicEnded) {
        hasPandemicEnded = false;
      }

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
        } else if (Date.now() - cell.lastTraveled > TRAVEL_PAUSE && cell.travelFrequency > Math.random()) {
          cell.travelTarget = new Vector2(Math.random(), Math.random());
        }
      }

      if (isInfected && !isQuarantined && Date.now() - cell.infectedAt > INFECTION_DELAY) {
        Object.keys(cells).forEach((compareId) => {
          const compare = cells[compareId];

          if (compare.infectedAt || compare.quarantinedAt) {
            return;
          }

          if (circleIntersection(cell.position, INFECTION_RADIUS, compare.position, INFECTION_RADIUS)) {
            cell.contacts.push(compare.id);
            cells[compareId].infectedAt = Date.now();
            cells[compareId].infectedBy = cell.id;
          }
        });
      }

      if (isQuarantined && !cell.hasNotifiedContacts && Date.now() - cell.quarantinedAt > NOTIFICATION_DELAY) {
        cell.hasNotifiedContacts = true;
        quarantine(cell.id, [...cell.contacts, cell.infectedBy]);
      }

      cells[id] = cell;

      const [cellDrawX, cellDrawY] = view(cell.position);

      const cellDrawRadius = canvas.width * CELL_RADIUS;
      const testDrawRadius = canvas.width * TEST_OUTLINE_RADIUS;

      ctx.fillStyle = COLORS.BLUE;
      ctx.globalAlpha = 1;

      if (isInfected && !isQuarantined) {
        ctx.fillStyle = COLORS.RED;
        ctx.strokeStyle = COLORS.RED;
      } else if (isQuarantined) {
        ctx.fillStyle = COLORS.GRAY;
        ctx.strokeStyle = COLORS.GRAY;
        ctx.globalAlpha = 0.5;
      }

      if (isQuarantined && indexCaseId === cell.id) {
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(cellDrawX, cellDrawY, testDrawRadius, 0, Math.PI * 2, true);

        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.arc(cellDrawX, cellDrawY, cellDrawRadius, 0, Math.PI * 2, true);
      ctx.fill();

      if (isInfected) {
        cell.contacts.forEach((contactId) => {
          const contact = cells[contactId];

          if (!contact) {
            return;
          }

          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(cellDrawX, cellDrawY);
          ctx.lineTo(...view(contact.position));
          ctx.stroke();

          ctx.save();
          const angle = -Math.atan2(contact.position.x - cell.position.x, contact.position.y - cell.position.y);
          ctx.translate(...view(contact.position));
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-5, -12);
          ctx.lineTo(5, -12);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      }
    });

    if (!hasPandemicEnded && !Object.values(cells).find((cell) => cell.infectedAt && !cell.quarantinedAt)) {
      hasPandemicEnded = true;
      onPandemicEnd();
    }

    ctx.restore();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return () => {
    stop = true;
    window.removeEventListener('resize', onResize);
  };
}

(function() {
  const resetButton = document.getElementById('reset');

  function onPandemicEnd() {
    resetButton.style.opacity = 1;
  }

  let stop = simulation(onPandemicEnd);

  resetButton.addEventListener('click', () => {
    stop();
    stop = simulation(onPandemicEnd);
    resetButton.style.opacity = 0.5;
  });
})();
