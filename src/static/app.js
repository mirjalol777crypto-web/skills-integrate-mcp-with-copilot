document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");
  const availabilityFilter = document.getElementById("availability-filter");
  const sortSelect = document.getElementById("sort-select");

  let allActivities = {};

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      allActivities = await response.json();

      if (!allActivities || Object.keys(allActivities).length === 0) {
        activitiesList.innerHTML =
          "<p>No activities available.</p>";
        if (categoryFilter) {
          categoryFilter.innerHTML = '<option value="">All Categories</option>';
        }
        if (activitySelect) {
          activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
        }
        return;
      }

      populateCategoryFilter();
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
      if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
      }
      if (activitySelect) {
        activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
      }
    }
  }

  function populateCategoryFilter() {
    if (!categoryFilter) return;
    
    const categories = new Set();
    Object.values(allActivities).forEach((activity) => {
      if (activity && activity.category) {
        categories.add(activity.category);
      }
    });

    categoryFilter.innerHTML = '<option value="">All Categories</option>';

    if (categories.size > 0) {
      Array.from(categories)
        .sort()
        .forEach((category) => {
          const option = document.createElement("option");
          option.value = category;
          option.textContent = category;
          categoryFilter.appendChild(option);
        });
    }
  }

  function getFilteredActivities() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedCategory = categoryFilter.value;
    const selectedAvailability = availabilityFilter.value;
    const sortOption = sortSelect.value;

    let filtered = Object.entries(allActivities).filter(([name, details]) => {
      if (searchTerm) {
        const searchableText = `${name} ${details.description} ${details.schedule}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      if (selectedCategory && details.category !== selectedCategory) {
        return false;
      }

      if (selectedAvailability) {
        const spotsLeft = details.max_participants - details.participants.length;
        if (selectedAvailability === "available" && spotsLeft === 0) {
          return false;
        }
        if (selectedAvailability === "full" && spotsLeft > 0) {
          return false;
        }
      }

      return true;
    });

    filtered.sort(([nameA, detailsA], [nameB, detailsB]) => {
      switch (sortOption) {
        case "name-asc":
          return nameA.localeCompare(nameB);
        case "name-desc":
          return nameB.localeCompare(nameA);
        case "time-asc":
          const timeA = detailsA.datetime || "";
          const timeB = detailsB.datetime || "";
          return timeA.localeCompare(timeB);
        case "time-desc":
          const timeA2 = detailsA.datetime || "";
          const timeB2 = detailsB.datetime || "";
          return timeB2.localeCompare(timeA2);
        default:
          return 0;
      }
    });

    return filtered;
  }

  function renderActivities() {
    if (!activitiesList || !activitySelect) return;
    
    const filtered = getFilteredActivities();

    activitiesList.innerHTML = "";
    
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
    Object.keys(allActivities).sort().forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      activitySelect.appendChild(option);
    });

    if (filtered.length === 0) {
      activitiesList.innerHTML = "<p>No activities match your filters.</p>";
      return;
    }

    filtered.forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft =
        details.max_participants - details.participants.length;

      // Create participants HTML with delete icons instead of bullet points
      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

      const categoryDisplay = details.category
        ? `<p><strong>Category:</strong> ${details.category}</p>`
        : "";

      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p>${details.description}</p>
        ${categoryDisplay}
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
      `;

      activitiesList.appendChild(activityCard);
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  searchInput.addEventListener("input", renderActivities);
  categoryFilter.addEventListener("change", renderActivities);
  availabilityFilter.addEventListener("change", renderActivities);
  sortSelect.addEventListener("change", renderActivities);

  fetchActivities();
});
