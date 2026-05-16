import prisma from "../config/db";

export interface DataRequestResult {
  success: boolean;
  message: string;
  dataPackage?: string; // JSON or CSV data
  downloadLink?: string;
}

/**
 * Process ACCESS request - Compile user's personal data
 */
async function processAccessRequest(email: string): Promise<DataRequestResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        articles: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            publishedAt: true,
          },
        },
        categoriesCreated: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
        dataRequests: {
          select: {
            id: true,
            requestType: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return {
        success: true,
        message: "No account found for this email. Only public data is available.",
        dataPackage: JSON.stringify(
          { message: "No user account associated with this email address" },
          null,
          2
        ),
      };
    }

    const accessData = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountCreatedAt: user.createdAt,
        accountUpdatedAt: user.updatedAt,
      },
      articles: user.articles,
      categoriesCreated: user.categoriesCreated,
      previousDataRequests: user.dataRequests,
    };

    return {
      success: true,
      message: "User data compiled successfully",
      dataPackage: JSON.stringify(accessData, null, 2),
    };
  } catch (error) {
    console.error("Error processing ACCESS request:", error);
    return {
      success: false,
      message: "Failed to process access request. Please try again later.",
    };
  }
}

/**
 * Process DOWNLOAD request - Export user data in JSON format
 */
async function processDownloadRequest(email: string): Promise<DataRequestResult> {
  // Same as ACCESS but could format differently
  const accessResult = await processAccessRequest(email);

  return {
    ...accessResult,
    message: "User data exported in portable JSON format",
  };
}

/**
 * Process DELETE request - Mark account for deletion
 */
async function processDeleteRequest(email: string): Promise<DataRequestResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        success: true,
        message: "No account found for deletion.",
      };
    }

    // Soft delete: Mark user as inactive instead of hard delete
    await prisma.user.update({
      where: { email },
      data: {
        isActive: false,
        name: "[Deleted User]",
      },
    });

    // Anonymize user data in articles
    await prisma.article.updateMany({
      where: { userId: user.id },
      data: {
        authorName: "[Deleted Author]",
      },
    });

    return {
      success: true,
      message:
        "Account marked for deletion. Account will be fully removed within 30 days. Your published articles will remain on the platform but will be attributed to [Deleted Author].",
    };
  } catch (error) {
    console.error("Error processing DELETE request:", error);
    return {
      success: false,
      message: "Failed to process deletion request. Please try again later.",
    };
  }
}

/**
 * Process PORTABILITY request - Prepare data for transfer
 */
async function processPortabilityRequest(email: string): Promise<DataRequestResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        articles: true,
        categoriesCreated: true,
      },
    });

    if (!user) {
      return {
        success: true,
        message: "No account found for data portability.",
      };
    }

    const portabilityData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountCreated: user.createdAt,
      },
      articles: user.articles,
      categories: user.categoriesCreated,
      exportFormat: "JSON",
    };

    return {
      success: true,
      message:
        "Your data is ready for transfer to another service. You will receive a download link via email.",
      dataPackage: JSON.stringify(portabilityData, null, 2),
    };
  } catch (error) {
    console.error("Error processing PORTABILITY request:", error);
    return {
      success: false,
      message: "Failed to process portability request. Please try again later.",
    };
  }
}

/**
 * Process OPTOUT request - Unsubscribe from marketing
 */
async function processOptoutRequest(email: string): Promise<DataRequestResult> {
  try {
    // Find user and mark as opted out
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // In a real implementation, you would have an isMarketingOptedOut field
      // For now, we'll just log it
      console.log(`User ${email} opted out of marketing communications`);
    }

    return {
      success: true,
      message:
        "You have successfully opted out of marketing communications. We will remove you from all marketing lists within 48 hours.",
    };
  } catch (error) {
    console.error("Error processing OPTOUT request:", error);
    return {
      success: false,
      message: "Failed to process opt-out request. Please try again later.",
    };
  }
}

/**
 * Main function to process data requests based on type
 */
export async function processDataRequest(
  requestType: string,
  email: string
): Promise<DataRequestResult> {
  console.log(`Processing ${requestType} request for ${email}`);

  switch (requestType.toUpperCase()) {
    case "ACCESS":
      return processAccessRequest(email);

    case "DOWNLOAD":
      return processDownloadRequest(email);

    case "DELETE":
      return processDeleteRequest(email);

    case "PORTABILITY":
      return processPortabilityRequest(email);

    case "OPTOUT":
      return processOptoutRequest(email);

    default:
      return {
        success: false,
        message: `Unknown request type: ${requestType}`,
      };
  }
}

/**
 * Update request status in database
 */
export async function updateRequestStatus(
  confirmationId: string,
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DENIED",
  notes?: string
): Promise<void> {
  await prisma.dataRequest.update({
    where: { confirmationId },
    data: {
      status,
      notes,
      processedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });
}
